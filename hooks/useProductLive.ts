"use client";

import { useEffect, useMemo, useState } from "react";
import {
  fetchProductLive,
  type ProductLiveResponse,
} from "@/lib/site-manager/product-overrides-api";
import {
  mergeProductWithLive,
  pickDefaultVariantSpec,
} from "@/lib/woocommerce/product-live-merge";
import type { Product } from "@/lib/types/product";

const LIVE_CACHE_PREFIX = "ybb:product-live:v1:";
const LIVE_CACHE_TTL_MS = 5 * 60 * 1000;

type LiveCacheEntry = {
  savedAt: number;
  payload: ProductLiveResponse;
};

function readLiveCache(handle: string): ProductLiveResponse | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(`${LIVE_CACHE_PREFIX}${handle}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LiveCacheEntry;
    if (!parsed?.payload || Date.now() - parsed.savedAt > LIVE_CACHE_TTL_MS) {
      sessionStorage.removeItem(`${LIVE_CACHE_PREFIX}${handle}`);
      return null;
    }
    return parsed.payload;
  } catch {
    return null;
  }
}

function isLiveCacheStale(
  cached: ProductLiveResponse,
  remote: ProductLiveResponse
): boolean {
  if (cached.syncedAt && remote.syncedAt && cached.syncedAt !== remote.syncedAt) {
    return true;
  }
  const cachedHtml = cached.content?.description?.html?.en ?? "";
  const remoteHtml = remote.content?.description?.html?.en ?? "";
  if (cachedHtml !== remoteHtml) return true;
  const cachedSpi = cached.shopPayInstallments?.template?.en ?? "";
  const remoteSpi = remote.shopPayInstallments?.template?.en ?? "";
  if (cachedSpi !== remoteSpi) return true;

  const cachedSlogan = cached.purchaseSlogan;
  const remoteSlogan = remote.purchaseSlogan;
  if (!!cachedSlogan?.visible !== !!remoteSlogan?.visible) return true;
  for (const lang of ["en", "zh", "ja"] as const) {
    if ((cachedSlogan?.text?.[lang] ?? "") !== (remoteSlogan?.text?.[lang] ?? "")) {
      return true;
    }
  }

  return false;
}

function writeLiveCache(handle: string, payload: ProductLiveResponse): void {
  if (typeof window === "undefined") return;
  try {
    const entry: LiveCacheEntry = { savedAt: Date.now(), payload };
    sessionStorage.setItem(`${LIVE_CACHE_PREFIX}${handle}`, JSON.stringify(entry));
  } catch {
    // ignore quota / private mode
  }
}

async function fetchProductLiveWithRetry(
  handle: string,
  attempts = 3
): Promise<ProductLiveResponse | null> {
  for (let i = 0; i < attempts; i++) {
    const remote = await fetchProductLive(handle);
    if (remote) return remote;
    if (i < attempts - 1) {
      await new Promise((resolve) => setTimeout(resolve, 400 * (i + 1)));
    }
  }
  return null;
}

export function useProductLive(staticProduct: Product) {
  const handle = staticProduct.handle;
  const [live, setLive] = useState<ProductLiveResponse | null>(() => readLiveCache(handle));
  const [ready, setReady] = useState(() => readLiveCache(handle) !== null);

  useEffect(() => {
    let cancelled = false;
    const cached = readLiveCache(handle);
    if (cached) {
      setLive(cached);
      setReady(true);
    } else {
      setReady(false);
    }

    void fetchProductLiveWithRetry(handle).then((remote) => {
      if (cancelled) return;
      if (remote) {
        if (cached && isLiveCacheStale(cached, remote)) {
          sessionStorage.removeItem(`${LIVE_CACHE_PREFIX}${handle}`);
        }
        writeLiveCache(handle, remote);
        setLive(remote);
        setReady(true);
        return;
      }
      if (cached) {
        setLive(cached);
        setReady(true);
        return;
      }
      setReady(true);
    });

    return () => {
      cancelled = true;
    };
  }, [handle]);

  const product = useMemo(
    () => mergeProductWithLive(staticProduct, live),
    [staticProduct, live]
  );

  const defaultVariantSpec = useMemo(
    () => pickDefaultVariantSpec(product),
    [product]
  );

  return { product, live, ready, defaultVariantSpec };
}
