"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CarouselArrows } from "@/components/home/CarouselArrows";
import { PRODUCT_CAROUSEL_SLIDE_CLASS } from "@/components/carousel/EmblaProductCarousel";
import { ScrollReveal } from "@/components/motion/ScrollReveal";
import { getProductByHandle } from "@/lib/data/products";
import {
  fetchHotProducts,
  type HotProductItem,
} from "@/lib/hot-products";
import { useEnrichedProducts } from "@/hooks/useEnrichedProducts";
import { useEmblaWithAutoplay } from "@/lib/hooks/useEmblaCarousel";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { Product } from "@/lib/types/product";
import { ProductCard } from "@/components/product/ProductCard";

function toImageSrc(image: string): string {
  if (!image) return "";
  if (image.startsWith("http://") || image.startsWith("https://")) return image;
  return image.startsWith("/") ? image : `/${image}`;
}

function mergeHotProduct(remote: HotProductItem): Product | null {
  const local = getProductByHandle(remote.handle);
  const images = remote.image
    ? [toImageSrc(remote.image)]
    : local?.images?.length
      ? local.images
      : [`/products/${remote.handle}/master.webp`];

  if (!local && !remote.title) return null;

  return {
    handle: remote.handle,
    title: remote.title,
    titleEn: remote.title,
    titleZh: remote.title,
    titleJa: remote.title,
    price: remote.price || local?.price || 0,
    compareAtPrice: remote.compareAtPrice ?? local?.compareAtPrice,
    images,
    collection: local?.collection ?? "",
    available: remote.available ?? local?.available ?? true,
    tags: local?.tags ?? [],
    sku: local?.sku,
    wcId: local?.wcId,
    variants: local?.variants,
    productType: local?.productType,
  };
}

export function HotProductsCarousel() {
  const { t } = useI18n();
  const [items, setItems] = useState<Product[]>([]);
  const [ready, setReady] = useState(false);
  const [autoplayDelay, setAutoplayDelay] = useState(4000);
  const productList = useMemo(() => items, [items]);
  const { products: enrichedProducts } = useEnrichedProducts(productList);
  const loop = enrichedProducts.length > 4;

  const { emblaRef, emblaApi, canScrollPrev, canScrollNext, scrollPrev, scrollNext } =
    useEmblaWithAutoplay({
      emblaOptions: {
        align: "start",
        containScroll: "trimSnaps",
        slidesToScroll: 1,
        dragFree: false,
        loop,
      },
      autoplayDelay,
      pauseOnHover: true,
    });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const remote = await fetchHotProducts();
      if (cancelled) return;
      if (remote?.products?.length) {
        const merged = remote.products
          .map(mergeHotProduct)
          .filter((p): p is Product => Boolean(p));
        if (merged.length) {
          setItems(merged);
          if (remote.autoplayMs >= 2000) {
            setAutoplayDelay(remote.autoplayMs);
          }
        }
      }
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    emblaApi?.reInit();
  }, [emblaApi, enrichedProducts.length, loop]);

  if (ready && !enrichedProducts.length) return null;

  return (
    <section
      className="page-container"
      aria-labelledby="hot-products-heading"
      data-ybb-hot-ready={ready ? "1" : undefined}
      style={ready ? undefined : { minHeight: "1px" }}
    >
      <div className="mb-8 flex items-center justify-between gap-4">
        <ScrollReveal animate="fade-up-large">
          <h2 id="hot-products-heading" className="text-title-md">
            {t("home.hotProducts")}
          </h2>
        </ScrollReveal>
        <CarouselArrows
          onPrev={scrollPrev}
          onNext={scrollNext}
          prevDisabled={!canScrollPrev}
          nextDisabled={!canScrollNext}
        />
      </div>

      <div
        ref={emblaRef}
        className="overflow-hidden"
        role="region"
        aria-roledescription="carousel"
        aria-label={t("home.hotProductsCarousel")}
        aria-busy={!ready}
      >
        <div className="flex touch-pan-y gap-4 md:gap-6">
          {enrichedProducts.map((product, i) => (
            <div key={product.handle} className={PRODUCT_CAROUSEL_SLIDE_CLASS}>
              <ProductCard
                product={product}
                priority={i < 2}
                imageAspect="square"
                revealIndex={i}
              />
            </div>
          ))}
        </div>
      </div>

      <Link
        href="/collections"
        className="mt-6 inline-flex text-sm font-medium underline-offset-4 hover:underline sm:hidden"
      >
        {t("home.viewAllHotProducts")}
      </Link>
    </section>
  );
}
