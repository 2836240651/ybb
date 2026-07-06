"use client";

import { fetchYbbJson } from "@/lib/ybb-rest";

export type ProductOverrideRow = {
  titleZh?: string;
  titleJa?: string;
  frontHidden?: boolean;
  descriptionZh?: string;
  descriptionJa?: string;
  hideDescription?: boolean;
  hideAdditionalInfo?: boolean;
  galleryEnabled?: boolean;
  galleryOverrideEnabled?: boolean;
  galleryDefaultIndex?: number;
  galleryImages?: string[];
  galleryHideIndexes?: number[];
  sloganEn?: string;
  sloganZh?: string;
  sloganJa?: string;
  hideSlogan?: boolean;
};

export type PurchaseSloganPayload = {
  visible: boolean;
  text: { en: string; zh: string; ja: string };
};

export type ProductAdditionalRow = {
  key: string;
  label: string;
  value: string;
  href?: string | null;
  taxonomy?: string;
  termSlug?: string;
};

export type ProductContentPayload = {
  description: {
    visible: boolean;
    html: { en: string; zh: string; ja: string };
  };
  additionalInfo: {
    visible: boolean;
    rows: ProductAdditionalRow[];
  };
};

export type ProductGalleryPayload = {
  enabled: boolean;
  layout: "bottom-strip";
  defaultIndex: number;
  images: string[];
  hideIndexes: number[];
  /** Woo baseline image list (for admin hint + debugging). */
  wooImages?: string[];
  /** Non-empty only when Site Manager override URL list is active. */
  overrideImages?: string[];
  source?: "woo" | "override";
};

export type ProductOverridesResponse = {
  enabled: boolean;
  overrides: Record<string, ProductOverrideRow>;
  syncedAt?: string;
};

export type LiveProductVariantApi = {
  spec: string;
  sku: string;
  wcId: number;
  price: number;
  compareAtPrice?: number | null;
  available: boolean;
  wcAttributes?: Array<{ attribute: string; value: string }>;
};

export type ProductLiveResponse = {
  handle: string;
  parentSku?: string;
  wcId: number;
  wooStatus?: string;
  titles: {
    en: string;
    zh: string;
    ja: string;
  };
  price: number;
  compareAtPrice?: number | null;
  available: boolean;
  variants: LiveProductVariantApi[];
  frontHidden?: boolean;
  content?: ProductContentPayload;
  gallery?: ProductGalleryPayload;
  purchaseSlogan?: PurchaseSloganPayload;
  images?: string[];
  syncedAt?: string;
};

export async function fetchProductOverrides(): Promise<ProductOverridesResponse | null> {
  return fetchYbbJson<ProductOverridesResponse>(
    "/ybb/v1/site-manager/product-overrides"
  );
}

export async function fetchProductLive(
  handle: string
): Promise<ProductLiveResponse | null> {
  const normalized = handle.trim().toLowerCase();
  if (!normalized) return null;
  return fetchYbbJson<ProductLiveResponse>(
    `/ybb/v1/site-manager/product-live/${encodeURIComponent(normalized)}`
  );
}
