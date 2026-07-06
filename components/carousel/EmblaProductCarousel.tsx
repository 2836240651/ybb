"use client";

import useEmblaCarousel from "embla-carousel-react";
import { useCallback, useEffect } from "react";
import { ProductCard } from "@/components/product/ProductCard";
import type { Product } from "@/lib/types/product";
import { useEmblaNavigation } from "@/lib/hooks/useEmblaCarousel";
import { CarouselArrows } from "@/components/home/CarouselArrows";

/** Equal-width slides: ~1 card mobile, 2 tablet, 4 desktop (gap-6 = 1.5rem). */
export const PRODUCT_CAROUSEL_SLIDE_CLASS =
  "min-w-0 shrink-0 grow-0 basis-[min(80vw,280px)] sm:basis-[calc((100%-1.5rem)/2)] lg:basis-[calc((100%-4.5rem)/4)]";

type EmblaProductCarouselProps = {
  products: Product[];
  ariaLabel?: string;
  arrowsClassName?: string;
  showArrows?: boolean;
};

export function EmblaProductCarousel({
  products,
  ariaLabel = "Product carousel",
  arrowsClassName,
  showArrows = true,
}: EmblaProductCarouselProps) {
  const [emblaRef, emblaApi] = useEmblaCarousel({
    align: "start",
    containScroll: "trimSnaps",
    slidesToScroll: 1,
    dragFree: false,
    loop: false,
  });

  const { canScrollPrev, canScrollNext, scrollPrev, scrollNext } =
    useEmblaNavigation(emblaApi);

  const reInit = useCallback(() => emblaApi?.reInit(), [emblaApi]);

  useEffect(() => {
    reInit();
  }, [products, reInit]);

  return (
    <div className="relative">
      <div
        ref={emblaRef}
        className="overflow-hidden"
        role="region"
        aria-roledescription="carousel"
        aria-label={ariaLabel}
      >
        <div className="flex touch-pan-y gap-4 md:gap-6">
          {products.map((product, i) => (
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
      {showArrows && (
        <CarouselArrows
          className={arrowsClassName}
          onPrev={scrollPrev}
          onNext={scrollNext}
          prevDisabled={!canScrollPrev}
          nextDisabled={!canScrollNext}
        />
      )}
    </div>
  );
}
