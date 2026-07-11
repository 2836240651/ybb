"use client";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://carp-ybb.com";
const CACHE_KEY = "ybb_product_live_summaries_v1";
const CACHE_TTL_MS = 60_000;

export type LiveProductSummary = {
  wcId: number;
  price: number;
  compareAtPrice?: number;
  available: boolean;
  /** Woo Featured Image — same source as PDP main image */
  image?: string;
};

type CacheEntry = {
  expiresAt: number;
  summaries: Record<string, LiveProductSummary>;
};

function storeApiUrl(path: string) {
  const route = path.startsWith("/wp-json") ? path.replace(/^\/wp-json/, "") : path;
  const base = `${SITE.replace(/\/$/, "")}/index.php`;
  return `${base}?${new URLSearchParams({ rest_route: route }).toString()}`;
}

function priceFromStorePrices(prices: unknown): number {
  const row = prices as { price?: unknown; regular_price?: unknown; sale_price?: unknown };
  const raw = row?.price ?? row?.sale_price ?? row?.regular_price;
  const minor = Number(raw);
  if (!Number.isFinite(minor) || minor <= 0) return 0;
  return Math.round((minor / 100) * 100) / 100;
}

function compareAtFromStorePrices(prices: unknown, price: number): number | undefined {
  const row = prices as { regular_price?: unknown; sale_price?: unknown };
  const regular = priceFromStorePrices({ price: row?.regular_price });
  const sale = priceFromStorePrices({ price: row?.sale_price });
  if (sale > 0 && regular > sale) return regular;
  if (regular > price) return regular;
  return undefined;
}

function readCache(wcIds: number[]): Map<number, LiveProductSummary> {
  const out = new Map<number, LiveProductSummary>();
  if (typeof window === "undefined") return out;
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return out;
    const parsed = JSON.parse(raw) as CacheEntry;
    if (!parsed?.summaries || Date.now() > parsed.expiresAt) return out;
    for (const id of wcIds) {
      const hit = parsed.summaries[String(id)];
      if (hit) out.set(id, hit);
    }
  } catch {
    // ignore corrupt cache
  }
  return out;
}

function writeCache(entries: Map<number, LiveProductSummary>) {
  if (typeof window === "undefined" || entries.size === 0) return;
  try {
    const existingRaw = sessionStorage.getItem(CACHE_KEY);
    const existing = existingRaw
      ? (JSON.parse(existingRaw) as CacheEntry)
      : { expiresAt: Date.now() + CACHE_TTL_MS, summaries: {} };
    const summaries = { ...existing.summaries };
    for (const [id, summary] of entries) {
      summaries[String(id)] = summary;
    }
    const payload: CacheEntry = {
      expiresAt: Date.now() + CACHE_TTL_MS,
      summaries,
    };
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(payload));
  } catch {
    // quota or private mode
  }
}

type StoreProductRow = {
  id?: number;
  prices?: unknown;
  is_in_stock?: boolean;
  is_purchasable?: boolean;
  images?: Array<{ src?: string }>;
};

const STORE_BATCH_SIZE = 24;
const FALLBACK_PARALLEL = 3;

function summaryFromStoreRow(
  wcId: number,
  data: StoreProductRow
): LiveProductSummary {
  const price = priceFromStorePrices(data.prices);
  const compareAtPrice = compareAtFromStorePrices(data.prices, price);
  const image = data.images?.find((row) => row?.src)?.src;

  return {
    wcId,
    price,
    compareAtPrice,
    available:
      Boolean(data.is_in_stock ?? true) &&
      Boolean(data.is_purchasable ?? true),
    ...(image ? { image } : {}),
  };
}

async function fetchStoreJson(url: string): Promise<unknown | null> {
  try {
    const res = await fetch(url, {
      credentials: "same-origin",
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

async function fetchStoreProductSummary(
  wcId: number
): Promise<LiveProductSummary | null> {
  const data = (await fetchStoreJson(
    storeApiUrl(`/wc/store/v1/products/${wcId}`)
  )) as StoreProductRow | null;
  if (!data) return null;
  return summaryFromStoreRow(wcId, data);
}

async function fetchStoreProductSummariesBatch(
  wcIds: number[]
): Promise<Map<number, LiveProductSummary>> {
  const out = new Map<number, LiveProductSummary>();
  if (!wcIds.length) return out;

  const include = wcIds.join(",");
  const perPage = String(wcIds.length);
  const query = new URLSearchParams({ include, per_page: perPage }).toString();
  const urls = [
    storeApiUrl(`/wc/store/v1/products?${query}`),
    `${SITE.replace(/\/$/, "")}/wp-json/wc/store/v1/products?${query}`,
  ];

  for (const url of urls) {
    const data = await fetchStoreJson(url);
    const rows = Array.isArray(data) ? (data as StoreProductRow[]) : [];
    for (const row of rows) {
      const wcId = Number(row.id);
      if (!wcId) continue;
      out.set(wcId, summaryFromStoreRow(wcId, row));
    }
    if (out.size > 0) break;
  }

  return out;
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

export async function fetchLiveProductSummaries(
  wcIds: number[]
): Promise<Map<number, LiveProductSummary>> {
  const unique = [...new Set(wcIds.filter((id) => id > 0))];
  const out = readCache(unique);
  const missing = unique.filter((id) => !out.has(id));

  for (const batch of chunk(missing, STORE_BATCH_SIZE)) {
    const batchMap = await fetchStoreProductSummariesBatch(batch);
    const toWrite = new Map<number, LiveProductSummary>();

    for (const id of batch) {
      const hit = batchMap.get(id);
      if (!hit) continue;
      out.set(id, hit);
      toWrite.set(id, hit);
    }

    const stillMissing = batch.filter((id) => !out.has(id));
    for (const fallbackBatch of chunk(stillMissing, FALLBACK_PARALLEL)) {
      const fetched = await Promise.all(
        fallbackBatch.map((id) => fetchStoreProductSummary(id))
      );
      for (const summary of fetched) {
        if (!summary) continue;
        out.set(summary.wcId, summary);
        toWrite.set(summary.wcId, summary);
      }
    }

    writeCache(toWrite);
  }

  return out;
}
