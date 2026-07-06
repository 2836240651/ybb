"use client";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://carp-ybb.com";

/** Max reviews shown in PDP content tab. */
export const PDP_REVIEWS_TAB_LIMIT = 10;

function storeApiUrl(path: string) {
  const route = path.startsWith("/wp-json") ? path.replace(/^\/wp-json/, "") : path;
  const base = `${SITE.replace(/\/$/, "")}/index.php`;
  return `${base}?${new URLSearchParams({ rest_route: route }).toString()}`;
}

export type ProductReviewImage = {
  id: number;
  url: string;
  thumb: string;
  width: number;
  height: number;
};

export type ProductReviewRow = {
  id: number;
  author: string;
  rating: number;
  content: string;
  date: string;
  images?: ProductReviewImage[];
};

export type ProductReviewsPayload = {
  product_id: number;
  review_count: number;
  average_rating: number;
  reviews: ProductReviewRow[];
  limit?: number;
};

export type FetchProductReviewsOptions = {
  limit?: number;
};

export async function fetchProductReviews(
  wcId: number,
  options?: FetchProductReviewsOptions
): Promise<ProductReviewsPayload> {
  const params = new URLSearchParams({ _: String(Date.now()) });
  if (options?.limit != null && options.limit > 0) {
    params.set("limit", String(options.limit));
  }
  const base = `${SITE.replace(/\/$/, "")}/wp-json/ybb/v1/product-reviews/${wcId}`;
  const url = `${base}?${params.toString()}`;
  const res = await fetch(url, {
    credentials: "same-origin",
    cache: "no-store",
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`product-reviews HTTP ${res.status}`);
  }
  return res.json();
}

/** Live count from Woo Store API �?no rebuild needed after admin changes. */
export async function fetchLiveReviewCount(wcId: number): Promise<number> {
  const res = await fetch(storeApiUrl(`/wc/store/v1/products/${wcId}`), {
    credentials: "same-origin",
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`store product HTTP ${res.status}`);
  }
  const data = (await res.json()) as { review_count?: number };
  return Number(data.review_count ?? 0) || 0;
}

export function productReviewFormEmbedUrl(wcId: number): string {
  const base = `${SITE.replace(/\/$/, "")}/ybb-product-reviews-embed.php`;
  return `${base}?${new URLSearchParams({ product_id: String(wcId) }).toString()}`;
}
