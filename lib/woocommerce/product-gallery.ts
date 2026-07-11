import type { ProductGalleryPayload } from "@/lib/site-manager/product-overrides-api";
import type { Product, ProductVariant } from "@/lib/types/product";
import { getProductGalleryImages } from "@/lib/data/products";

export type ResolvedProductGallery = {
  images: string[];
  defaultIndex: number;
  enabled: boolean;
  source: "woo" | "override" | "static";
};

function normalizeUrls(urls: string[] | undefined): string[] {
  if (!urls?.length) return [];
  return urls.filter((url) => typeof url === "string" && url.trim().length > 0);
}

/**
 * Gallery priority:
 * 1. Woo images from product-live (`gallery.wooImages` or `live.images`)
 * 2. Site Manager override URLs only when `gallery.source === "override"`
 * 3. Static products.json fallback before live is ready
 */
export function resolveProductGallery(
  staticProduct: Product,
  liveGallery: ProductGalleryPayload | undefined,
  liveImages: string[] | undefined,
  variant: ProductVariant | undefined,
  liveReady: boolean
): ResolvedProductGallery {
  const staticImages = normalizeUrls(getProductGalleryImages(staticProduct, variant));
  const wooImages = normalizeUrls(liveGallery?.wooImages?.length ? liveGallery.wooImages : liveImages);
  const overrideImages = normalizeUrls(liveGallery?.overrideImages);
  const galleryImages = normalizeUrls(liveGallery?.images);

  let images: string[] = [];
  let source: ResolvedProductGallery["source"] = "static";

  if (liveReady) {
    const useOverride =
      liveGallery?.source === "override" && overrideImages.length > 0;

    if (useOverride) {
      images = galleryImages.length > 0 ? galleryImages : overrideImages;
      source = "override";
    } else if (wooImages.length > 0) {
      images = wooImages;
      source = "woo";
    } else if (galleryImages.length > 0) {
      images = galleryImages;
      source = "woo";
    } else {
      images = staticImages;
      source = "static";
    }
  } else {
    images = wooImages.length > 0 ? wooImages : staticImages;
    source = wooImages.length > 0 ? "woo" : "static";
  }

  const defaultIndexRaw =
    liveGallery?.source === "override"
      ? Number(liveGallery?.defaultIndex ?? 0)
      : 0;
  const defaultIndex =
    Number.isFinite(defaultIndexRaw) &&
    defaultIndexRaw >= 0 &&
    defaultIndexRaw < images.length
      ? defaultIndexRaw
      : 0;

  const enabled = liveGallery?.enabled !== false;

  return {
    images,
    defaultIndex,
    enabled,
    source,
  };
}
