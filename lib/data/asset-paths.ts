/**
 * Asset path mapping for YBB Tackle replica.
 *
 * Pipeline (offline, read-only on cloud drive):
 *   node scripts/export-product-images.mjs --limit 20   # smoke test
 *   node scripts/export-product-images.mjs --all        # full catalog
 *
 * Source: E:\迅雷云盘\... (assets-manifest.csv primary_image / products.json sourceImage)
 * Output: public/products/{handle}/master.webp  �? /products/{handle}/master.webp
 *
 * Targets: max edge 1200px, WebP ~100�?00KB (smaller sources may be under 100KB).
 */

/** Fallback when export has not run for a SKU */
export const PLACEHOLDER_PRODUCT_IMAGE = "/images/placeholder-product.jpg";

/** Public URL prefix for exported masters */
export const PUBLIC_PRODUCTS_DIR = "/products";

/** Standard master filename produced by export-product-images.mjs */
export const MASTER_IMAGE_FILENAME = "master.webp";

/** Cloud-drive photography root (read-only; not served to browser) */
export const SOURCE_ASSET_ROOT = "E:\\迅雷云盘\\产品原图素材";

/** Canonical web URL for an exported product master image */
export function masterImageUrl(handle: string): string {
  return `${PUBLIC_PRODUCTS_DIR}/${handle}/${MASTER_IMAGE_FILENAME}`;
}

/**
 * @deprecated Prefer masterImageUrl �?pipeline normalizes to master.webp
 */
export function sourcePathToPublicUrl(
  _sourcePath: string,
  handle: string
): string {
  return masterImageUrl(handle);
}

/** Public URL for homepage collection atmosphere card */
export function collectionImageUrl(handle: string): string {
  return `/images/collections/${handle}.webp`;
}

/** Full-site fixed background (carp fishing hero) */
export const SITE_BACKGROUND_IMAGE =
  "/images/site/carpfishing-fullscreen-hero-bg-v2.png";

/**
 * Resolve card/PDP image: use first images[] entry, else master URL if exported flag set.
 */
export function resolveProductImage(
  images: string[] | undefined,
  handle: string
): string {
  const first = images?.[0];
  if (first && first !== PLACEHOLDER_PRODUCT_IMAGE) {
    return first;
  }
  return masterImageUrl(handle);
}
