"use client";

import type {
  ProductLiveResponse,
  ProductOverrideRow,
} from "@/lib/site-manager/product-overrides-api";
import type { LiveProductSummary } from "@/lib/woocommerce/product-live-api";
import { PLACEHOLDER_PRODUCT_IMAGE } from "@/lib/data/asset-paths";
import type { Product, ProductVariant } from "@/lib/types/product";

function hasCatalogImage(images: string[] | undefined): boolean {
  const first = images?.[0];
  return Boolean(first && first !== PLACEHOLDER_PRODUCT_IMAGE);
}

function mergeVariantPreservingI18n(
  staticVariant: ProductVariant | undefined,
  liveVariant: ProductVariant
): ProductVariant {
  if (!staticVariant) return liveVariant;
  return {
    ...liveVariant,
    specEn: staticVariant.specEn ?? liveVariant.specEn,
    specZh: staticVariant.specZh ?? liveVariant.specZh,
    specJa: staticVariant.specJa ?? liveVariant.specJa,
  };
}

export function liveVariantsToProductVariants(
  live: ProductLiveResponse
): ProductVariant[] {
  if (!live.variants?.length) {
    return [];
  }

  return live.variants.map((variant) => ({
    sku: variant.sku,
    spec: variant.spec,
    price: variant.price,
    compareAtPrice: variant.compareAtPrice ?? undefined,
    available: variant.available,
    wcId: variant.wcId,
    wcAttributes: variant.wcAttributes,
  }));
}

export function mergeProductWithLive(
  product: Product,
  live: ProductLiveResponse | null
): Product {
  if (!live) {
    return product;
  }

  const liveVariants = liveVariantsToProductVariants(live);
  const staticVariants = product.variants ?? [];
  const variants =
    liveVariants.length > 0
      ? liveVariants.map((liveVariant) => {
          const staticVariant = staticVariants.find(
            (v) =>
              (liveVariant.wcId && v.wcId === liveVariant.wcId) ||
              v.sku === liveVariant.sku ||
              v.spec === liveVariant.spec
          );
          return mergeVariantPreservingI18n(staticVariant, liveVariant);
        })
      : product.variants;
  const minPrice =
    liveVariants.length > 0
      ? Math.min(...liveVariants.map((v) => v.price).filter((p) => p > 0))
      : live.price;

  const frontHidden = Boolean(live.frontHidden);
  const purchasable =
    live.available && live.wooStatus === "publish" && !frontHidden;

  const liveImages = live.images?.filter((url) => typeof url === "string" && url.length > 0) ?? [];

  return {
    ...product,
    ...(liveImages.length ? { images: liveImages } : {}),
    title: live.titles.en || product.title,
    titleEn: live.titles.en || product.titleEn || product.title,
    titleZh: live.titles.zh || product.titleZh,
    titleJa: live.titles.ja || product.titleJa,
    titleCn: live.titles.zh || product.titleCn,
    price: minPrice > 0 ? minPrice : live.price || product.price,
    compareAtPrice: live.compareAtPrice ?? product.compareAtPrice,
    available: purchasable,
    wcId: live.wcId || product.wcId,
    variants,
    defaultVariantSku: variants?.[0]?.sku ?? product.defaultVariantSku,
    productType:
      liveVariants.length > 1 ? "variable" : product.productType,
  };
}

export function pickDefaultVariantSpec(
  product: Product,
  preferred?: string
): string {
  const variants = product.variants ?? [];
  if (!variants.length) {
    return preferred || product.spec || "Default";
  }
  if (preferred) {
    const match = variants.find(
      (v) => v.spec === preferred || v.sku === preferred
    );
    if (match) return match.spec;
  }
  const defaultSku = product.defaultVariantSku;
  const byDefault = defaultSku
    ? variants.find((v) => v.sku === defaultSku)
    : undefined;
  return byDefault?.spec ?? variants[0]?.spec ?? "Default";
}

export function filterProductsForCatalog(
  products: Product[],
  overrides: Record<string, ProductOverrideRow>,
  overridesReady: boolean
): Product[] {
  if (!overridesReady) return products;
  return products.filter((product) => !overrides[product.handle]?.frontHidden);
}

export function applyOverridesToProduct(
  product: Product,
  override?: ProductOverrideRow
): Product {
  if (!override) return product;
  return {
    ...product,
    titleZh: override.titleZh || product.titleZh,
    titleJa: override.titleJa || product.titleJa,
    titleCn: override.titleZh || product.titleCn,
  };
}

export function applyLiveSummaryToProduct(
  product: Product,
  summary?: LiveProductSummary
): Product {
  if (!summary) return product;

  // List cards: keep static/Woo images; only adopt live image when catalog has none.
  const images = hasCatalogImage(product.images)
    ? product.images
    : summary.image
      ? [summary.image]
      : product.images;

  return {
    ...product,
    price: summary.price > 0 ? summary.price : product.price,
    compareAtPrice: summary.compareAtPrice ?? product.compareAtPrice,
    available: summary.available,
    wcId: summary.wcId || product.wcId,
    images: images?.length ? images : product.images,
  };
}

export function enrichProductForList(
  product: Product,
  override: ProductOverrideRow | undefined,
  summary: LiveProductSummary | undefined
): Product {
  return applyLiveSummaryToProduct(
    applyOverridesToProduct(product, override),
    summary
  );
}
