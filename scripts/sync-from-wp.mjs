/**
 * Pull WooCommerce products + WordPress pages into local JSON before build.
 *
 * Usage:
 *   node scripts/sync-from-wp.mjs
 *   node scripts/sync-from-wp.mjs --site https://carp-ybb.com
 *   node scripts/sync-from-wp.mjs --from-catalog   # OFFLINE preview only (all catalog rows, not Woo)
 *   node scripts/sync-from-wp.mjs --fetch-variations # slow: enrich every variable product from Woo
 *   node scripts/sync-from-wp.mjs --woo-cache reports/woo-store-products-cache.json
 *   node scripts/sync-from-wp.mjs --skip-wp        # offline: keep existing JSON
 */

import { existsSync, readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { canonicalVariantSku } from "../lib/sku-normalize.mjs";
import {
  collectionFromSkuPrefix,
  loadNavCollectionRollups,
  productHandlesForCollection,
} from "./lib/catalog-rollup.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const site = process.argv.includes("--site")
  ? process.argv[process.argv.indexOf("--site") + 1]
  : process.env.NEXT_PUBLIC_SITE_URL || "https://carp-ybb.com";
const skipWp = process.argv.includes("--skip-wp");
const fromCatalog = process.argv.includes("--from-catalog");
const fetchVariations = process.argv.includes("--fetch-variations");
const wooCachePath = process.argv.includes("--woo-cache")
  ? process.argv[process.argv.indexOf("--woo-cache") + 1]
  : null;
const translationWarnings = [];

/** WP page slug -> { kind, handle } for local JSON */
const LEGAL_WP_SLUGS = {
  shipping: { kind: "policy", handle: "shipping" },
  privacy: { kind: "policy", handle: "privacy" },
  terms: { kind: "policy", handle: "terms" },
  refund_returns: { kind: "policy", handle: "refund" },
  samples: { kind: "page", handle: "samples" },
  "moq-lead-time": { kind: "page", handle: "moq-lead-time" },
};

function decodeHtml(text) {
  return text
    .replace(/&#8211;/g, "-")
    .replace(/&#8217;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripTags(html) {
  return decodeHtml(html.replace(/<script[\s\S]*?<\/script>/gi, ""));
}

function htmlToSections(html) {
  const sections = [];
  const chunks = html.split(/<h2[^>]*>/i).slice(1);
  for (const chunk of chunks) {
    const [headingPart, ...rest] = chunk.split(/<\/h2>/i);
    const heading = stripTags(headingPart);
    const bodyHtml = rest.join("</h2>");
    const paragraphs = bodyHtml
      .split(/<\/p>/i)
      .map((p) => stripTags(p.replace(/<p[^>]*>/i, "")))
      .filter((p) => p.length > 20);
    if (heading) {
      sections.push({ heading, paragraphs: paragraphs.length ? paragraphs : [stripTags(bodyHtml)] });
    }
  }
  if (!sections.length) {
    const plain = stripTags(html);
    if (plain) {
      sections.push({ heading: "Overview", paragraphs: [plain.slice(0, 2000)] });
    }
  }
  return sections;
}

function wpRestUrl(route, params = {}) {
  const base = `${site.replace(/\/$/, "")}/index.php`;
  const qs = new URLSearchParams({ rest_route: route, ...params });
  return `${base}?${qs.toString()}`;
}
async function fetchJson(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": "ybb-sync-from-wp/1.0", "Cache-Control": "no-cache" },
    signal: AbortSignal.timeout(120000),
  });
  if (!res.ok) {
    throw new Error(`${url} -> HTTP ${res.status}`);
  }
  return res.json();
}

async function syncSiteBrand() {
  const outPath = join(root, "lib/data/site-brand.json");
  const navPath = join(root, "lib/data/navigation.json");

  let brand = null;
  try {
    brand = await fetchJson(`${site.replace(/\/$/, "")}/wp-json/ybb/v1/site-brand`);
  } catch {
  }

  if (!brand?.name) {
    try {
      const wp = await fetchJson(`${site.replace(/\/$/, "")}/wp-json/`);
      brand = {
        name: decodeHtml(String(wp.name || "YBB")),
        tagline: {
          en: decodeHtml(String(wp.description || "Trusted Tackle Partner")),
          zh: "值得信赖的渔具合作伙伴",
          ja: "信頼できるタックルパートナー",
        },
        logoAlt: decodeHtml(String(wp.name || "YBB")),
        logoPath: "/images/brand/ybb-logo.png",
        source: "wp-json-root",
      };
    } catch (err) {
      console.warn("[sync-from-wp] site brand sync skipped:", err.message);
      return false;
    }
  }

  const payload = {
    name: brand.name || "YBB",
    tagline: {
      en: brand.tagline?.en || brand.tagline_en || "Trusted Tackle Partner",
      zh: brand.tagline?.zh || brand.tagline_zh || "值得信赖的渔具合作伙伴",
      ja: brand.tagline?.ja || brand.tagline_ja || "信頼できるタックルパートナー",
    },
    logoAlt: brand.logoAlt || brand.name || "YBB",
    logoPath: brand.logoPath || "/images/brand/ybb-logo.png",
    source: brand.source || "wordpress",
    syncedAt: new Date().toISOString(),
  };

  writeFileSync(outPath, JSON.stringify(payload, null, 2) + "\n", "utf8");

  const navigation = JSON.parse(readFileSync(navPath, "utf8"));
  navigation.brand = {
    ...navigation.brand,
    name: payload.name,
    tagline: payload.tagline.en,
    logoAlt: payload.logoAlt,
  };
  writeFileSync(navPath, JSON.stringify(navigation, null, 2) + "\n", "utf8");
  console.log(`[sync-from-wp] site brand: ${payload.name} / ${payload.tagline.en}`);
  return true;
}

async function syncHomeSettings() {
  const outPath = join(root, "lib/data/home-settings.json");

  let settings = null;
  try {
    settings = await fetchJson(
      `${site.replace(/\/$/, "")}/wp-json/ybb/v1/home-settings?_=${Date.now()}`
    );
  } catch {
  }

  const payload = {
    wholesaleCollectionsEnabled:
      settings?.wholesaleCollectionsEnabled !== false,
    source: settings?.source || "wordpress",
    syncedAt: new Date().toISOString(),
  };

  writeFileSync(outPath, JSON.stringify(payload, null, 2) + "\n", "utf8");
  console.log(
    `[sync-from-wp] home settings: wholesaleCollections=${payload.wholesaleCollectionsEnabled}`
  );
  return true;
}

async function fetchAllStoreProducts() {
  if (wooCachePath && existsSync(wooCachePath)) {
    const cached = JSON.parse(readFileSync(wooCachePath, "utf8"));
    const products = Array.isArray(cached) ? cached : cached?.products;
    if (Array.isArray(products)) {
      console.log(
        `[sync-from-wp] using woo cache: ${wooCachePath} (${products.length} products)`
      );
      return products;
    }
    throw new Error(`invalid --woo-cache file: ${wooCachePath}`);
  }

  const all = [];
  let page = 1;
  while (true) {
    const url = wpRestUrl("/wc/store/v1/products", { per_page: "100", page: String(page) });
    const batch = await fetchJson(url);
    if (!Array.isArray(batch) || batch.length === 0) break;
    all.push(...batch);
    if (batch.length < 100) break;
    page += 1;
  }
  return all;
}

function priceFromWc(prices) {
  if (!prices?.price) return 0;
  const minor = Number(prices.price);
  const minorUnit = Number(prices.currency_minor_unit ?? 2);
  const divisor = 10 ** minorUnit;
  return Math.round((minor / divisor) * 100) / 100;
}

/** Catalog/manifest rows may store Woo minor units (49) or dollars (0.49). */
function priceFromCatalogRaw(raw, minorUnit = 2) {
  const str = String(raw ?? "").trim();
  const n = Number.parseFloat(str) || 0;
  if (!n) return 0;
  if (str.includes(".")) return n;
  const divisor = 10 ** minorUnit;
  return Math.round((n / divisor) * 100) / 100;
}


const i18nPath = join(root, "lib/data/product-i18n-by-sku.json");
let i18nBySku = {};
try {
  i18nBySku = JSON.parse(readFileSync(i18nPath, "utf8"));
} catch {
  i18nBySku = {};
}

function parentSkuFromVariant(sku) {
  const parts = (sku || "").split("-");
  if (parts.length < 3) return sku;
  return parts.slice(0, 3).join("-");
}

const manifestPath = join(root, "deploy/product-import/manifest.json");
let skuToCategorySlugs = {};
let i18nByParentSku = {};
let catalog = null;
let idMap = { parents: {}, variations: {} };
let frontendCollectionHandles = new Set();
try {
  const frontendCollections = JSON.parse(
    readFileSync(join(root, "lib/data/collections.json"), "utf8")
  );
  frontendCollectionHandles = new Set(frontendCollections.map((c) => c.handle));
} catch {
  frontendCollectionHandles = new Set();
}
try {
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  skuToCategorySlugs = manifest?.categoryTerms?.skuToCategorySlugs || {};
  i18nByParentSku = manifest?.i18nByParentSku || {};
  if (manifest?.i18nBySku) {
    for (const [sku, row] of Object.entries(manifest.i18nBySku)) {
      const parent = parentSkuFromVariant(sku);
      if (!i18nByParentSku[parent] && row?.titleEn) {
        i18nByParentSku[parent] = {
          titleEn: row.titleEn,
          titleZh: row.titleZh,
          titleJa: row.titleJa,
        };
      }
    }
  }
} catch {
  skuToCategorySlugs = {};
  i18nByParentSku = {};
}

/** Prefer 独立站上架 pipeline manifest (build-wp-title-map) when present. */
const wpListingManifest =
  process.env.YBB_WP_LISTING_MANIFEST ||
  "D:/dev/独立站上架/output/wp/manifest.json";
try {
  const listing = JSON.parse(readFileSync(wpListingManifest, "utf8"));
  if (listing?.i18nByParentSku) {
    i18nByParentSku = { ...i18nByParentSku, ...listing.i18nByParentSku };
  }
} catch {
  // optional
}
try {
  catalog = JSON.parse(readFileSync(join(root, "deploy/product-import/wc-catalog.json"), "utf8"));
} catch {
  catalog = null;
}
try {
  idMap = JSON.parse(readFileSync(join(root, "deploy/product-import/wc-id-map.json"), "utf8"));
} catch {
  idMap = { parents: {}, variations: {} };
}

export const WOO_COLLECTION_SLUG_ALIASES = {
  "carp-fishing-leads": "sinkers",
  "inline-tube-insert-lead": "sinkers",
  "carp-fishing-rigs": "rigs",
};

export function normalizeCollectionSlug(slug) {
  const raw = slug || "";
  const aliased = WOO_COLLECTION_SLUG_ALIASES[raw] || raw;
  if (frontendCollectionHandles.has(aliased)) return aliased;
  const parent = aliased.split("--")[0];
  return frontendCollectionHandles.has(parent) ? parent : aliased;
}

export function selectFrontendCollection(candidateSlugs = []) {
  const normalized = candidateSlugs.map(normalizeCollectionSlug).filter(Boolean);
  const known = normalized.filter((slug) => frontendCollectionHandles.has(slug));
  return known.find((slug) => slug !== "other") || known[0] || normalized[0];
}

function collectionForParentSku(parentSku, categorySlugs, wcParent) {
  const prefixCollection = collectionFromSkuPrefix(
    parentSku,
    frontendCollectionHandles
  );
  if (prefixCollection) return prefixCollection;

  const manifestSlugs = skuToCategorySlugs[parentSku];
  const manifestCollection = selectFrontendCollection(
    Array.isArray(manifestSlugs) ? manifestSlugs : []
  );
  if (manifestCollection) return manifestCollection;

  const catalogCollection = selectFrontendCollection(
    Array.isArray(categorySlugs) ? categorySlugs : []
  );
  if (catalogCollection) return catalogCollection;

  const wcCollection = selectFrontendCollection(
    (wcParent?.categories || []).map((category) => category.slug)
  );
  if (wcCollection) return wcCollection;

  const prefixFallback = collectionFromSkuPrefix(parentSku);
  if (prefixFallback) return prefixFallback;

  return null;
}

function skuHandle(sku) {
  return (sku || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function hasHan(text) {
  return /[\u4e00-\u9fff]/.test(text || "");
}

function resolveProductTitles(parentSku, entry, wcParent, parentI18n) {
  const legacySku = i18nBySku[parentSku] || {};
  const wcName = decodeHtml(wcParent?.name || "");

  const titleEn =
    (parentI18n.titleEn && !hasHan(parentI18n.titleEn) ? parentI18n.titleEn : "") ||
    (wcName && !hasHan(wcName) ? wcName : "") ||
    (legacySku.titleEn && !hasHan(legacySku.titleEn) ? legacySku.titleEn : "") ||
    parentI18n.titleEn ||
    wcName ||
    legacySku.titleEn ||
    entry.nameEn ||
    entry.name ||
    parentSku;

  const titleZh =
    parentI18n.titleZh || legacySku.titleZh || entry.nameZh || entry.name || titleEn;

  const titleJa =
    parentI18n.titleJa || legacySku.titleJa || entry.nameJa || titleEn;

  if (!parentI18n.titleJa && !entry.nameJa && titleJa === titleEn) {
    translationWarnings.push({ parentSku, field: "titleJa", fallback: titleEn });
  }

  return { titleEn, titleZh, titleJa };
}

function variantImageUrl(variantSku) {
  return `/products/${skuHandle(variantSku)}/master.webp`;
}

function localPublicAssetExists(publicUrl) {
  if (!publicUrl?.startsWith("/")) return false;
  return existsSync(join(root, "public", publicUrl.replace(/^\/+/, "")));
}

function imageSources(images) {
  return (images || [])
    .map((image) => image?.src || image?.url || "")
    .filter(Boolean);
}

function variantImages(variantSku, wcVariation) {
  const localUrl = variantImageUrl(variantSku);
  if (localPublicAssetExists(localUrl)) return [localUrl];
  return imageSources(wcVariation?.images);
}

function wcAttributesFromVariation(wcVariation) {
  return (wcVariation?.attributes || [])
    .map((attr) => ({
      attribute: String(attr?.name || attr?.attribute || "").trim(),
      value: String(attr?.value || attr?.option || "").trim(),
    }))
    .filter((attr) => attr.attribute && attr.value);
}

function attributeOptions(attr) {
  const rawTerms = attr?.terms || attr?.options || [];
  return rawTerms
    .map((term) =>
      typeof term === "string"
        ? term
        : term?.name || term?.slug || term?.value || ""
    )
    .map((term) => String(term).trim())
    .filter(Boolean);
}

function inferWcAttributes(variation, wcVariation, wcParent) {
  const direct = wcAttributesFromVariation(wcVariation);
  if (direct.length) return direct;

  const spec = String(variation?.spec || "").trim();
  if (!spec) return [];

  const candidateAttrs = (wcParent?.attributes || []).filter((attr) => {
    const options = attributeOptions(attr);
    return options.length === 0 || options.includes(spec);
  });
  if (candidateAttrs.length !== 1) return [];

  const attrName = String(
    candidateAttrs[0]?.name || candidateAttrs[0]?.attribute || ""
  ).trim();
  return attrName ? [{ attribute: attrName, value: spec }] : [];
}

function catalogByParentSku() {
  const map = new Map();
  if (!catalog?.products) return map;
  for (const entry of catalog.products) {
    map.set(entry.parentSku, entry);
  }
  return map;
}

function indexWcVariations(variations) {
  const map = new Map();
  for (const v of variations || []) {
    if (v.sku) map.set(v.sku, v);
    for (const attr of v.attributes || []) {
      const value = typeof attr?.value === "string" ? attr.value.trim() : "";
      if (value) map.set(value, v);
    }
  }
  map.raw = variations || [];
  return map;
}

function lookupWcVariation(wcVariationsByKey, variation) {
  if (!wcVariationsByKey) return undefined;
  return (
    wcVariationsByKey.get(variation.sku) ||
    wcVariationsByKey.get(variation.spec) ||
    undefined
  );
}

function buildVariantFromCatalog(variation, wcVariation, idMapEntry, wcParent) {
  const sku = variation.sku;
  const spec = variation.spec || sku;
  const hasWcPrice =
    wcVariation?.prices?.price != null || wcVariation?.prices?.regular_price != null;
  const price = hasWcPrice
    ? priceFromWc(wcVariation.prices)
    : priceFromCatalogRaw(
        variation.price || variation.regularPrice || "0",
        wcParent?.prices?.currency_minor_unit ?? 2
      );
  const compareAtPrice =
    wcVariation?.on_sale && wcVariation.prices?.regular_price
      ? priceFromWc({ price: wcVariation.prices.regular_price })
      : undefined;
  const wcId = wcVariation?.id || idMapEntry?.id;
  const images = variantImages(sku, wcVariation);
  const wcAttributes = inferWcAttributes(variation, wcVariation, wcParent);

  const variant = {
    sku,
    spec,
    price,
    compareAtPrice,
    available: wcVariation
      ? hasWcPrice
        ? Boolean(wcVariation.is_in_stock ?? wcVariation.is_purchasable)
        : true
      : true,
    wcId,
  };
  if (images.length) variant.images = images;
  if (wcAttributes.length) variant.wcAttributes = wcAttributes;
  return variant;
}

function buildVariantsFromWooDetails(entry, wcParent, wcVariationsBySku) {
  const rawVariations = wcVariationsBySku?.raw || [];
  if (!rawVariations.length) return [];

  return rawVariations.map((wcVariation, index) => {
    const wcAttributes = wcAttributesFromVariation(wcVariation);
    const spec =
      wcAttributes.map((attr) => attr.value).filter(Boolean).join(" / ") ||
      entry.variations?.[index]?.spec ||
      "Default";
    const fallbackVariation = entry.variations?.[index] || {};
    const wooSku = String(wcVariation.sku || "").trim();
    const sku =
      wooSku ||
      canonicalVariantSku(entry.parentSku, spec) ||
      `${entry.parentSku}-${spec}`;
    const hasWcPrice =
      wcVariation?.prices?.price != null || wcVariation?.prices?.regular_price != null;
    const price = hasWcPrice
      ? priceFromWc(wcVariation.prices)
      : priceFromCatalogRaw(
          fallbackVariation.price || entry.regularPrice || "0",
          wcParent?.prices?.currency_minor_unit ?? 2
        );
    const images = variantImages(sku, wcVariation);
    const variant = {
      sku,
      spec,
      price,
      compareAtPrice:
        wcVariation?.on_sale && wcVariation.prices?.regular_price
          ? priceFromWc({ price: wcVariation.prices.regular_price })
          : undefined,
      available: Boolean(wcVariation.is_in_stock ?? wcVariation.is_purchasable ?? true),
      wcId: wcVariation.id,
    };
    if (images.length) variant.images = images;
    if (wcAttributes.length) variant.wcAttributes = wcAttributes;
    return variant;
  });
}

function mapCatalogEntry(entry, wcParent, wcVariationsBySku, collectionOverride) {
  const parentSku = entry.parentSku;
  const handle = skuHandle(parentSku);
  const parentI18n = i18nByParentSku[parentSku] || {};
  const { titleEn, titleZh, titleJa } = resolveProductTitles(
    parentSku,
    entry,
    wcParent,
    parentI18n
  );
  const collection =
    collectionOverride ||
    collectionForParentSku(parentSku, entry.categorySlugs, wcParent) ||
    "sinkers";
  const parentIdMap = idMap.parents?.[parentSku];

  const isWooVariable = wcParent?.type === "variable";
  const isVariable = isWooVariable || entry.type === "variable";

  let variants =
    isVariable
      ? entry.variations.map((variation) =>
          buildVariantFromCatalog(
            variation,
            lookupWcVariation(wcVariationsBySku, variation),
            idMap.variations?.[variation.sku],
            wcParent
          )
        )
      : [
          buildVariantFromCatalog(
            {
              sku: entry.variationSku || entry.variations?.[0]?.sku || parentSku,
              spec: entry.spec || entry.variations?.[0]?.spec || "Default",
              price: entry.regularPrice || entry.variations?.[0]?.price || "0",
            },
            wcParent,
            idMap.variations?.[entry.variationSku || entry.variations?.[0]?.sku] ||
              parentIdMap,
            wcParent
          ),
        ];

  if (isVariable && wcVariationsBySku?.raw?.length) {
    const wooVariants = buildVariantsFromWooDetails(entry, wcParent, wcVariationsBySku);
    if (wooVariants.every((variant) => variant.wcId && variant.wcAttributes?.length)) {
      // Keep catalog spec i18n when Woo only supplies raw attribute text.
      variants = wooVariants.map((wooVar, index) => {
        const catalogVar = entry.variations?.[index] || entry.variations?.find((v) => v.sku === wooVar.sku);
        return enrichVariantSpecI18n(
          { ...wooVar, spec: catalogVar?.spec || wooVar.spec },
          catalogVar?.spec
        );
      });
    }
  }

  const prices = variants.map((v) => v.price).filter((p) => p > 0);
  const minPrice = prices.length ? Math.min(...prices) : 0;
  const firstVariant = variants[0];
  const wcImages = imageSources(wcParent?.images);
  const images = wcImages.length
    ? wcImages
    : firstVariant?.images?.length
      ? firstVariant.images
      : localPublicAssetExists(variantImageUrl(firstVariant?.sku || parentSku))
        ? [variantImageUrl(firstVariant?.sku || parentSku)]
        : ["/images/placeholder-product.jpg"];

  return {
    handle,
    title: titleEn,
    titleEn,
    titleZh,
    titleJa,
    titleCn: titleZh,
    price: minPrice,
    compareAtPrice:
      wcParent?.on_sale && wcParent.prices?.regular_price
        ? priceFromWc({ price: wcParent.prices.regular_price })
        : undefined,
    images,
    collection,
    available: variants.some((v) => v.available),
    tags: ["wholesale", ...(wcParent?.tags?.map((t) => t.slug) || [])],
    imageCount: images.length,
    sku: parentSku,
    wcId: wcParent?.id || parentIdMap?.id,
    productType: isVariable ? "variable" : "simple",
    variants,
    defaultVariantSku: firstVariant?.sku,
    spec: entry.type === "simple" ? firstVariant?.spec : undefined,
    permalink: wcParent?.permalink,
    reviewCount: Number(wcParent?.review_count ?? 0) || 0,
    averageRating: Number.parseFloat(String(wcParent?.average_rating ?? "0")) || 0,
  };
}

function buildProductsFromCatalog(catalogData, wcParentsBySku = new Map()) {
  return catalogData.products.map((entry) => {
    const wcParent = wcParentsBySku.get(entry.parentSku);
    return mapCatalogEntry(entry, wcParent, null);
  });
}

async function fetchStoreProductDetail(id) {
  return fetchJson(wpRestUrl(`/wc/store/v1/products/${id}`));
}

async function fetchStoreVariations(parentId) {
  return fetchJson(
    wpRestUrl("/wc/store/v1/products", {
      type: "variation",
      parent: String(parentId),
      per_page: "100",
    })
  );
}

function variationsHavePrices(variations) {
  return (
    Array.isArray(variations) &&
    variations.length > 0 &&
    variations.some((v) => v?.prices?.price != null || v?.prices?.regular_price != null)
  );
}

const categorySlugCache = new Map();

async function resolveWcCollectionSlug(wcParent) {
  const cat = wcParent?.categories?.[0];
  if (!cat?.id) return cat?.slug;
  if (categorySlugCache.has(cat.id)) return categorySlugCache.get(cat.id);
  try {
    const fresh = await fetchJson(wpRestUrl(`/wc/store/v1/products/categories/${cat.id}`));
    const slug = fresh?.slug || cat.slug;
    if (slug) categorySlugCache.set(cat.id, slug);
    return slug;
  } catch {
    return cat.slug;
  }
}

function buildCatalogStubFromWoo(wcParent) {
  const parentSku = wcParent.sku;
  const categorySlugs = (wcParent.categories || []).map((category) => category.slug).filter(Boolean);
  const isVariable = wcParent.type === "variable";
  const wooVariations = wcParent.variations || [];
  const variations = wooVariations.map((variation, index) => {
    const attrs = (variation.attributes || [])
      .map((attr) => attr.value || attr.option)
      .filter(Boolean);
    const spec =
      attrs.join(" / ") ||
      String(variation.sku || "")
        .replace(`${parentSku}-`, "")
        .trim() ||
      `Option ${index + 1}`;
    const prices = variation.prices || wcParent.prices;
    return {
      sku: variation.sku || `${parentSku}-${spec.replace(/\s+/g, "")}`,
      spec,
      price: prices ? priceFromWc(prices) : 0,
    };
  });

  if (!variations.length) {
    const prices = wcParent.prices;
    variations.push({
      sku: parentSku,
      spec: "Default",
      price: prices ? priceFromWc(prices) : 0,
    });
  }

  const name = decodeHtml(wcParent.name || parentSku);

  return {
    parentSku,
    name,
    nameZh: name,
    nameJa: name,
    type: isVariable ? "variable" : "simple",
    categorySlugs,
    variations,
    regularPrice: wcParent.prices ? priceFromWc(wcParent.prices) : 0,
    variationSku: variations[0]?.sku,
    spec: variations[0]?.spec,
  };
}

async function enrichFromWoo(parents, catalogData) {
  const catalogBySku = new Map(catalogData.products.map((e) => [e.parentSku, e]));
  const enriched = [];
  let stubbedFromWoo = 0;

  // Woo is source of truth: only products published on the store enter products.json.
  for (const p of parents) {
    const parentSku = p.sku;
    if (!parentSku) continue;

    let catalogEntry = catalogBySku.get(parentSku);
    if (!catalogEntry) {
      console.warn(
        `[sync-from-wp] auto-stub ${parentSku}: on Woo but missing in wc-catalog.json (using Woo metadata)`
      );
      catalogEntry = buildCatalogStubFromWoo(p);
      stubbedFromWoo += 1;
    }

    const rawCollectionOverride = await resolveWcCollectionSlug(p);
    const collectionOverride = selectFrontendCollection([rawCollectionOverride]);

    if (fetchVariations && p.type === "variable" && p.id) {
      try {
        const cachedVars = Array.isArray(p.variations) ? p.variations : [];
        let wcVariationRows = variationsHavePrices(cachedVars)
          ? cachedVars
          : null;
        if (!wcVariationRows) {
          const listed = await fetchStoreVariations(p.id);
          if (variationsHavePrices(listed)) {
            wcVariationRows = listed;
          }
        }
        if (!wcVariationRows) {
          const detail = await fetchStoreProductDetail(p.id);
          wcVariationRows = detail.variations || [];
        }
        const wcVariationsBySku = indexWcVariations(wcVariationRows);
        const detail = { ...p, variations: wcVariationRows };
        const detailCollection =
          selectFrontendCollection([await resolveWcCollectionSlug(detail)]) ||
          collectionOverride;
        enriched.push(
          mapCatalogEntry(catalogEntry, p, wcVariationsBySku, detailCollection)
        );
      } catch (err) {
        console.warn(`[sync-from-wp] variation fetch failed for ${parentSku}:`, err.message);
        enriched.push(mapCatalogEntry(catalogEntry, p, null, collectionOverride));
      }
    } else {
      enriched.push(mapCatalogEntry(catalogEntry, p, null, collectionOverride));
    }
  }

  console.log(
    `[sync-from-wp] Woo-first: ${enriched.length} products synced, ${stubbedFromWoo} auto-stubbed from Woo (not in wc-catalog)`
  );
  return enriched;
}

function copyVariantRedirects(productHandles) {
  const src = join(root, "deploy/product-import/variant-redirects.json");
  const dest = join(root, "lib/data/variant-redirects.json");
  const handleSet = new Set(productHandles);
  try {
    const all = JSON.parse(readFileSync(src, "utf8"));
    const filtered = Object.fromEntries(
      Object.entries(all).filter(([, target]) => {
        const parentHandle = target.split("/").pop()?.replace(/\.html$/, "") || target;
        return handleSet.has(parentHandle);
      })
    );
    writeFileSync(dest, JSON.stringify(filtered, null, 2) + "\n");
    return Object.keys(filtered).length;
  } catch {
    return 0;
  }
}

function updateCollections(products, collectionsPath, navigationPath) {
  const collections = JSON.parse(readFileSync(collectionsPath, "utf8"));
  let navRollups = {};
  try {
    const nav = JSON.parse(readFileSync(navigationPath, "utf8"));
    navRollups = loadNavCollectionRollups(nav);
  } catch {
    navRollups = {};
  }

  for (const col of collections) {
    const handles = productHandlesForCollection(col.handle, products, navRollups);
    col.productCount = handles.length;
    col.productHandles = handles;
  }
  writeFileSync(collectionsPath, JSON.stringify(collections, null, 2) + "\n", "utf8");
  return collections.length;
}

function upsertPolicy(policyPath, handle, wpPage) {
  const data = JSON.parse(readFileSync(policyPath, "utf8"));
  const sections = htmlToSections(wpPage.content?.rendered || "");
  const title = stripTags(wpPage.title?.rendered || handle);
  const description = stripTags(wpPage.excerpt?.rendered || "") || sections[0]?.paragraphs?.[0]?.slice(0, 160) || "";
  const entry = {
    title,
    description,
    sections,
  };
  if (!data[handle]) {
    data[handle] = { en: entry, zh: entry, ja: entry };
  } else {
    data[handle].en = entry;
  }
  writeFileSync(policyPath, JSON.stringify(data, null, 2) + "\n", "utf8");
}

function upsertInfoPage(infoPath, handle, wpPage) {
  const data = JSON.parse(readFileSync(infoPath, "utf8"));
  const sections = htmlToSections(wpPage.content?.rendered || "");
  const title = stripTags(wpPage.title?.rendered || handle);
  const description = stripTags(wpPage.excerpt?.rendered || "") || "";
  const entry = { title, description, sections };
  if (!data[handle]) {
    data[handle] = { en: entry, zh: entry, ja: entry };
  } else {
    data[handle].en = entry;
  }
  writeFileSync(infoPath, JSON.stringify(data, null, 2) + "\n", "utf8");
}

function upsertStaticPage(pagesPath, handle, wpPage) {
  const pages = JSON.parse(readFileSync(pagesPath, "utf8"));
  const sections = htmlToSections(wpPage.content?.rendered || "");
  const title = stripTags(wpPage.title?.rendered || handle);
  const description = stripTags(wpPage.excerpt?.rendered || "") || sections[0]?.paragraphs?.[0]?.slice(0, 160) || "";
  const idx = pages.findIndex((p) => p.handle === handle);
  const entry = { handle, title, description, sections };
  if (idx >= 0) pages[idx] = entry;
  else pages.push(entry);
  writeFileSync(pagesPath, JSON.stringify(pages, null, 2) + "\n", "utf8");
}

async function syncPages() {
  const slugs = Object.keys(LEGAL_WP_SLUGS).join(",");
  const wpPages = await fetchJson(
    wpRestUrl("/wp/v2/pages", { per_page: "50", slug: slugs, _fields: "slug,title,content,excerpt" })
  );
  const bySlug = Object.fromEntries(wpPages.map((p) => [p.slug, p]));
  const policyPath = join(root, "lib/data/policy-pages.json");
  const pagesPath = join(root, "lib/data/pages.json");
  const infoPath = join(root, "lib/data/info-pages.json");
  const INFO_HANDLES = new Set(["samples", "moq-lead-time"]);
  let synced = 0;
  for (const [wpSlug, meta] of Object.entries(LEGAL_WP_SLUGS)) {
    const wpPage = bySlug[wpSlug];
    if (!wpPage) {
      console.warn(`[sync-from-wp] missing WP page: ${wpSlug}`);
      continue;
    }
    if (meta.kind === "policy") {
      upsertPolicy(policyPath, meta.handle, wpPage);
    } else if (INFO_HANDLES.has(meta.handle)) {
      upsertInfoPage(infoPath, meta.handle, wpPage);
    } else {
      upsertStaticPage(pagesPath, meta.handle, wpPage);
    }
    synced += 1;
    console.log(`[sync-from-wp] page ${wpSlug} -> ${meta.kind}:${meta.handle}`);
  }
  return synced;
}

async function main() {
  if (skipWp) {
    console.log("[sync-from-wp] --skip-wp: keeping existing JSON");
    return 0;
  }

  console.log(`[sync-from-wp] site=${site}`);

  if (!catalog?.products?.length) {
    throw new Error(
      "missing deploy/product-import/wc-catalog.json — run py scripts/parse-product-form.py first"
    );
  }

  const catalogParentCount = catalog.stats?.productCount || catalog.products.length;
  let products;
  let source = "catalog";

  if (fromCatalog) {
    products = buildProductsFromCatalog(catalog);
    console.warn(
      `[sync-from-wp] --from-catalog: wrote ${products.length} rows from wc-catalog.json (NOT filtered by Woo — preview/offline only)`
    );
  } else {
    const wcProducts = await fetchAllStoreProducts();
    const parents = wcProducts.filter((p) => p.type !== "variation");
    console.log(
      `[sync-from-wp] WC store products: ${wcProducts.length} (${parents.length} parents)`
    );

    if (parents.length === 0) {
      console.warn("[sync-from-wp] Woo has 0 published products — products.json will be empty");
      products = [];
      source = "woocommerce-empty";
    } else {
      products = await enrichFromWoo(parents, catalog);
      source = "woocommerce";
    }
  }

  const productsPath = join(root, "lib/data/products.json");
  writeFileSync(productsPath, JSON.stringify(products, null, 2) + "\n", "utf8");

  const refreshedI18n = {};
  for (const p of products) {
    if (!p.sku) continue;
    refreshedI18n[p.sku] = {
      titleEn: p.titleEn,
      titleZh: p.titleZh,
      titleJa: p.titleJa,
    };
  }
  writeFileSync(i18nPath, JSON.stringify(refreshedI18n, null, 2) + "\n", "utf8");
  console.log(`[sync-from-wp] refreshed ${Object.keys(refreshedI18n).length} parent i18n rows`);

  if (translationWarnings.length) {
    const warnPath = join(root, "deploy/product-import/translation-warnings.json");
    writeFileSync(
      warnPath,
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          count: translationWarnings.length,
          warnings: translationWarnings,
        },
        null,
        2
      ) + "\n",
      "utf8"
    );
    console.warn(`[sync-from-wp] translation fallback warnings: ${translationWarnings.length} (see deploy/product-import/translation-warnings.json)`);
  }

  const colCount = updateCollections(
    products,
    join(root, "lib/data/collections.json"),
    join(root, "lib/data/navigation.json")
  );
  console.log(`[sync-from-wp] updated ${colCount} collections`);

  const redirectCount = copyVariantRedirects(products.map((p) => p.handle));
  console.log(`[sync-from-wp] copied ${redirectCount} variant redirects`);

  let pageCount = 0;
  try {
    pageCount = await syncPages();
    console.log(`[sync-from-wp] synced ${pageCount} WP pages`);
  } catch (err) {
    console.warn("[sync-from-wp] page sync skipped:", err.message);
  }

  try {
    await syncSiteBrand();
  } catch (err) {
    console.warn("[sync-from-wp] site brand sync failed:", err.message);
  }

  try {
    await syncHomeSettings();
  } catch (err) {
    console.warn("[sync-from-wp] home settings sync failed:", err.message);
  }

  const meta = {
    syncedAt: new Date().toISOString(),
    site,
    source,
    productCount: products.length,
    variationCount: products.reduce((n, p) => n + (p.variants?.length || 1), 0),
    pageCount,
  };
  writeFileSync(join(root, "lib/data/wp-sync-meta.json"), JSON.stringify(meta, null, 2) + "\n");
  console.log("[sync-from-wp] OK");
  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().then((code) => process.exit(code)).catch((err) => {
    console.error("[sync-from-wp] FAIL:", err);
    process.exit(1);
  });
}

