import type { Product } from "@/lib/types/product";

export function getProductReviewsPath(handle: string): string {
  return `/products/reviews/${handle}`;
}

export function getProductReviewsHref(product: Pick<Product, "handle">): string {
  return getProductReviewsPath(product.handle);
}

export function formatReviewCountDisplay(count: number): string {
  const safe = Math.max(0, Math.floor(count));
  return `${safe}+`;
}
