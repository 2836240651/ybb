"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  catalogMainCategories,
  catalogOther,
} from "@/lib/data/catalog";
import { useSiteNavigation } from "@/lib/site-manager/NavigationProvider";
import { wholesaleHandlesForNav } from "@/lib/site-manager/nav-sync";
import { collectionImageUrl } from "@/lib/data/asset-paths";
import { ScrollReveal } from "@/components/motion/ScrollReveal";
import { useCollectionTitle, useI18n } from "@/lib/i18n/I18nProvider";
import { useEmblaWithAutoplay } from "@/lib/hooks/useEmblaCarousel";
import { cn } from "@/lib/utils";

function ArrowIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  return reduced;
}

function CategoryCard({
  handle,
  fallbackTitle,
  imageSrc,
  isInView,
  reducedMotion,
}: {
  handle: string;
  fallbackTitle: string;
  imageSrc: string;
  isInView: boolean;
  reducedMotion: boolean;
}) {
  const { t } = useI18n();
  const title = useCollectionTitle(handle, fallbackTitle);

  return (
    <Link
      href={`/collections/${handle}`}
      className={cn(
        "group block relative rounded-card overflow-hidden aspect-[4/5]",
        "category-carousel__card",
        (reducedMotion || isInView) && "category-carousel__card--in-view"
      )}
      aria-label={t("home.browseCollection", { title })}
    >
      <Image
        src={imageSrc}
        alt=""
        fill
        sizes="(max-width: 768px) 75vw, 32vw"
        className="object-cover transition-transform duration-500 ease-primary group-hover:scale-[1.02]"
      />
      <div
        className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/10 to-transparent"
        aria-hidden
      />
      <h3 className="absolute bottom-4 left-4 sm:bottom-6 sm:left-6 text-white text-lg sm:text-2xl font-bold tracking-tight max-w-[70%]">
        {title}
      </h3>
      <span
        className="absolute bottom-4 right-4 sm:bottom-6 sm:right-6 inline-flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-full bg-[#171717] text-white interaction-carousel-arrow transition-transform duration-500 ease-primary group-hover:translate-x-0.5"
        aria-hidden
      >
        <ArrowIcon />
      </span>
    </Link>
  );
}

export function CategoryGrid() {
  const { t } = useI18n();
  const { primaryNav, ready } = useSiteNavigation();
  const reducedMotion = usePrefersReducedMotion();
  const [inViewHandles, setInViewHandles] = useState<Set<string>>(() => new Set());

  const featured = useMemo(() => {
    const byHandle = Object.fromEntries(
      [...catalogMainCategories, ...catalogOther.children].map((category) => [
        category.handle,
        category,
      ])
    );
    const handles = wholesaleHandlesForNav(primaryNav, ready);
    return handles.map((handle) => {
      const category = byHandle[handle];
      return {
        handle,
        title: category?.titleEn ?? handle,
      };
    });
  }, [primaryNav, ready]);

  const { emblaRef, emblaApi } = useEmblaWithAutoplay({
    emblaOptions: {
      align: "start",
      containScroll: false,
      loop: true,
      dragFree: false,
      duration: 55,
      skipSnaps: false,
    },
    autoplayDelay: 3800,
    pauseOnHover: true,
  });

  const updateSlidesInView = useCallback(() => {
    if (!emblaApi) return;
    const handles = new Set<string>();
    for (const index of emblaApi.slidesInView()) {
      const handle = emblaApi.slideNodes()[index]?.dataset.categoryHandle;
      if (handle) handles.add(handle);
    }
    setInViewHandles(handles);
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    updateSlidesInView();
    emblaApi.on("slidesInView", updateSlidesInView);
    emblaApi.on("reInit", updateSlidesInView);
    emblaApi.on("scroll", updateSlidesInView);
    emblaApi.on("select", updateSlidesInView);
    return () => {
      emblaApi.off("slidesInView", updateSlidesInView);
      emblaApi.off("reInit", updateSlidesInView);
      emblaApi.off("scroll", updateSlidesInView);
      emblaApi.off("select", updateSlidesInView);
    };
  }, [emblaApi, updateSlidesInView]);

  return (
    <section className="page-container" aria-labelledby="categories-heading">
      <div className="mb-8">
        <ScrollReveal animate="fade-up-large">
          <h2 id="categories-heading" className="text-title-md">
            {t("home.wholesaleCollections")}
          </h2>
        </ScrollReveal>
      </div>

      <div
        ref={emblaRef}
        className="category-carousel overflow-hidden"
        role="region"
        aria-roledescription="carousel"
        aria-label={t("home.wholesaleCollectionsTablist")}
      >
        <ul className="category-carousel__track flex touch-pan-y">
          {featured.map((col) => (
            <li
              key={col.handle}
              data-category-handle={col.handle}
              className={cn(
                "category-carousel__slide shrink-0 grow-0 min-w-0",
                "basis-[min(78vw,300px)] sm:basis-[calc((100%-1rem)/2.15)] lg:basis-[calc((100%-3rem)/3.15)]",
                "mr-3 sm:mr-4 md:mr-6"
              )}
            >
              <CategoryCard
                handle={col.handle}
                fallbackTitle={col.title}
                imageSrc={collectionImageUrl(col.handle)}
                isInView={inViewHandles.has(col.handle)}
                reducedMotion={reducedMotion}
              />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
