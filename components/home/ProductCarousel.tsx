"use client";

import Link from "next/link";
import { CarouselArrows } from "@/components/home/CarouselArrows";
import { PRODUCT_CAROUSEL_SLIDE_CLASS } from "@/components/carousel/EmblaProductCarousel";
import { ScrollReveal } from "@/components/motion/ScrollReveal";
import { getNewArrivals } from "@/lib/data/products";
import { useI18n } from "@/lib/i18n/I18nProvider";
import useEmblaCarousel from "embla-carousel-react";
import { useEmblaNavigation } from "@/lib/hooks/useEmblaCarousel";
import { ProductCard } from "@/components/product/ProductCard";

export function ProductCarousel() {
  const { t } = useI18n();
  const items = getNewArrivals(6);
  const [emblaRef, emblaApi] = useEmblaCarousel({
    align: "start",
    containScroll: "trimSnaps",
    slidesToScroll: 1,
    dragFree: false,
    loop: false,
  });
  const { canScrollPrev, canScrollNext, scrollPrev, scrollNext } =
    useEmblaNavigation(emblaApi);

  return (
    <section className="page-container" aria-labelledby="new-arrivals-heading">
      <div className="mb-8 flex items-center justify-between gap-4">
        <ScrollReveal animate="fade-up-large">
          <h2 id="new-arrivals-heading" className="text-title-md">
            {t("home.newArrivals")}
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
        aria-label={t("home.newArrivalsProducts")}
      >
        <div className="flex touch-pan-y gap-4 md:gap-6">
          {items.map((product, i) => (
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
        href="/collections/new-arrivals"
        className="mt-6 inline-flex text-sm font-medium underline-offset-4 hover:underline sm:hidden"
      >
        {t("common.viewAllNewArrivals")}
      </Link>
    </section>
  );
}
