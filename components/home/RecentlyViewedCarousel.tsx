"use client";

import Image from "next/image";
import Link from "next/link";
import useEmblaCarousel from "embla-carousel-react";
import { useEffect, useMemo, useState } from "react";
import { CarouselArrows } from "@/components/home/CarouselArrows";
import { ScrollReveal } from "@/components/motion/ScrollReveal";
import { PRODUCT_CAROUSEL_SLIDE_CLASS } from "@/components/carousel/EmblaProductCarousel";
import {
  formatPrice,
  getProductByHandle,
  getProductGalleryImages,
  products,
} from "@/lib/data/products";
import { useI18n, useProductTitle } from "@/lib/i18n/I18nProvider";
import { useEmblaNavigation } from "@/lib/hooks/useEmblaCarousel";
import {
  RECENTLY_VIEWED_MOCK_HANDLES,
  useRecentlyViewed,
} from "@/lib/store/recentlyViewed";
import type { Product } from "@/lib/types/product";
import { cn } from "@/lib/utils";

function resolveCarouselImages(product: Product) {
  const galleryImages = getProductGalleryImages(product);
  const primaryImage = galleryImages[0] ?? product.images[0];
  const hoverImage =
    product.images[1] ??
    galleryImages.find((src) => src && src !== primaryImage);
  const hasHoverImage = Boolean(
    hoverImage && hoverImage !== primaryImage
  );

  return { primaryImage, hoverImage, hasHoverImage };
}

function RecentlyViewedCard({
  product,
  revealIndex,
}: {
  product: Product;
  revealIndex: number;
}) {
  const { t } = useI18n();
  const title = useProductTitle(product);
  const soldOut = !product.available;
  const onSale =
    product.compareAtPrice != null && product.compareAtPrice > product.price;
  const [imageHovered, setImageHovered] = useState(false);

  const { primaryImage, hoverImage, hasHoverImage } = useMemo(
    () => resolveCarouselImages(product),
    [product]
  );

  const productHref = `/products/${product.handle}`;

  return (
    <article className="recently-viewed-card group relative flex flex-col">
      <ScrollReveal animate="zoom-out" staggerIndex={revealIndex} className="recently-viewed-card__media-shell rounded-card">
      <div
        className={cn(
          "recently-viewed-card__media relative aspect-square rounded-card",
          imageHovered && hasHoverImage && "recently-viewed-card__media--hovered"
        )}
        onMouseEnter={() => setImageHovered(true)}
        onMouseLeave={() => setImageHovered(false)}
      >
        <Link
          href={productHref}
          className="absolute inset-0 z-0 overflow-hidden rounded-card"
          aria-label={title}
          tabIndex={-1}
        >
          <Image
            src={primaryImage}
            alt={title}
            fill
            sizes="(max-width: 768px) 45vw, 22vw"
            className={cn(
              "recently-viewed-card__primary rounded-card object-contain object-center p-3 sm:p-4 mix-blend-multiply transition-opacity duration-300 ease-primary"
            )}
          />
          {hasHoverImage && hoverImage && (
            <div
              className="recently-viewed-card__secondary absolute inset-0 overflow-hidden rounded-card"
              aria-hidden
            >
              <Image
                src={hoverImage}
                alt=""
                fill
                sizes="(max-width: 768px) 45vw, 22vw"
                className="rounded-card object-contain object-center p-3 sm:p-4 mix-blend-multiply"
              />
            </div>
          )}
        </Link>

        {soldOut && (
          <span className="product-card-badge product-card-badge--sold-out absolute top-3 right-3 z-10 md:top-5 md:right-5">
            {t("product.soldOut")}
          </span>
        )}
      </div>
      </ScrollReveal>

      <ScrollReveal animate="fade-up" staggerIndex={revealIndex} delay={60}>
      <div className="flex items-start justify-between gap-3 py-3 sm:py-4">
        <Link href={productHref} className="min-w-0 flex-1">
          <h3 className="text-product line-clamp-2 transition-opacity duration-500 ease-primary group-hover:opacity-70">
            {title}
          </h3>
        </Link>
        <div className="shrink-0 text-right">
          <Link
            href={productHref}
            className="recently-viewed-price interaction-footer-link text-product font-medium"
          >
            {formatPrice(product.price)}
          </Link>
          {onSale && (
            <span className="block text-xs text-error line-through">
              {formatPrice(product.compareAtPrice!)}
            </span>
          )}
        </div>
      </div>
      </ScrollReveal>
    </article>
  );
}

export function RecentlyViewedCarousel() {
  const { t } = useI18n();
  const storedHandles = useRecentlyViewed((s) => s.handles);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  const displayProducts = useMemo(() => {
    const sourceHandles =
      hydrated && storedHandles.length > 0
        ? storedHandles.map((e) => e.handle)
        : [...RECENTLY_VIEWED_MOCK_HANDLES];

    const resolved = sourceHandles
      .map((handle) => getProductByHandle(handle))
      .filter((p): p is Product => Boolean(p));

    if (resolved.length > 0) return resolved.slice(0, 12);

    return products.slice(0, 8);
  }, [hydrated, storedHandles]);

  const [emblaRef, emblaApi] = useEmblaCarousel({
    align: "start",
    containScroll: "trimSnaps",
    slidesToScroll: 1,
    dragFree: false,
    loop: false,
  });
  const { canScrollPrev, canScrollNext, scrollPrev, scrollNext } =
    useEmblaNavigation(emblaApi);

  useEffect(() => {
    emblaApi?.reInit();
  }, [displayProducts, emblaApi]);

  if (displayProducts.length === 0) return null;

  return (
    <section className="page-container" aria-labelledby="recently-viewed-heading">
      <div className="mb-8 flex items-center justify-between gap-4">
        <ScrollReveal animate="fade-up-large">
          <h2 id="recently-viewed-heading" className="text-title-md">
            {t("home.recentlyViewed")}
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
        aria-label={t("home.recentlyViewedProducts")}
      >
        <div className="flex touch-pan-y gap-4 md:gap-6">
          {displayProducts.map((product, index) => (
            <div key={product.handle} className={PRODUCT_CAROUSEL_SLIDE_CLASS}>
              <RecentlyViewedCard product={product} revealIndex={index} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
