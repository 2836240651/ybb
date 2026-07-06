"use client";

import Link from "next/link";
import useEmblaCarousel from "embla-carousel-react";
import { useEffect, useState } from "react";
import { CarouselArrows } from "@/components/home/CarouselArrows";
import { ScrollReveal } from "@/components/motion/ScrollReveal";
import { useEmblaNavigation } from "@/lib/hooks/useEmblaCarousel";
import {
  fetchLatestStories,
  type LatestStoryArticle,
} from "@/lib/latest-stories";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { cn } from "@/lib/utils";

function formatDate(iso: string, locale: string) {
  const localeTag = locale === "zh" ? "zh-CN" : locale === "ja" ? "ja-JP" : "en-GB";
  return new Date(iso).toLocaleDateString(localeTag, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function toDisplaySrc(image: string): string {
  if (!image) return "";
  let src = image;
  if (src.startsWith("http://")) {
    src = `https://${src.slice(7)}`;
  }
  if (src.startsWith("http://") || src.startsWith("https://")) return src;
  return src.startsWith("/") ? src : `/${src}`;
}

function StoryImage({ src, alt }: { src: string; alt: string }) {
  const display = toDisplaySrc(src);
  if (!display) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={display}
      alt={alt}
      className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 ease-primary group-hover:scale-[1.02]"
      loading={undefined}
      decoding="async"
    />
  );
}

export function BlogCarousel() {
  const { t, locale } = useI18n();
  const [articles, setArticles] = useState<LatestStoryArticle[]>([]);
  const [ready, setReady] = useState(false);
  const [emblaRef, emblaApi] = useEmblaCarousel({
    align: "start",
    containScroll: "trimSnaps",
    dragFree: false,
  });
  const { canScrollPrev, canScrollNext, scrollPrev, scrollNext } =
    useEmblaNavigation(emblaApi);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const remote = await fetchLatestStories();
      if (cancelled) return;
      if (remote?.articles?.length) {
        setArticles(remote.articles);
      } else {
        setArticles([]);
      }
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!emblaApi || !ready) return;
    emblaApi.reInit();
  }, [emblaApi, articles, ready]);

  if (ready && !articles.length) return null;

  return (
    <section
      className="page-container"
      aria-labelledby="latest-stories-heading"
      data-ybb-stories-ready={ready ? "1" : undefined}
      style={ready ? undefined : { minHeight: "1px" }}
    >
      <div className="mb-8 flex items-center justify-between gap-4">
        <ScrollReveal animate="fade-up-large">
          <h2 id="latest-stories-heading" className="text-title-md">
            {t("home.latestStories")}
          </h2>
        </ScrollReveal>
        <div className="flex items-center gap-4">
          <Link
            href="/blogs/news"
            className="hidden sm:inline text-sm font-medium underline-offset-4 hover:underline"
          >
            {t("common.viewAll")}
          </Link>
          <CarouselArrows
            onPrev={scrollPrev}
            onNext={scrollNext}
            prevDisabled={!canScrollPrev}
            nextDisabled={!canScrollNext}
          />
        </div>
      </div>

      <div
        ref={emblaRef}
        className="overflow-hidden -mx-1 px-1"
        role="region"
        aria-roledescription="carousel"
        aria-label={t("home.latestStories")}
        aria-busy={!ready}
      >
        <div className="flex touch-pan-y gap-4 md:gap-6 items-stretch">
          {articles.map((article, index) => (
            <article
              key={`${article.handle}-${index}`}
              className={cn(
                "min-w-0 shrink-0 flex flex-col self-stretch",
                "w-[min(85vw,300px)] sm:w-[min(45vw,360px)] lg:w-[calc((100%-3*1.5rem)/4)]"
              )}
            >
              <Link
                href={article.href}
                className="group flex h-full flex-col rounded-card overflow-hidden border border-border bg-white transition-[box-shadow,transform] duration-500 ease-primary hover:shadow-lg hover:scale-[1.02]"
              >
                <div className="relative aspect-[16/10] shrink-0 overflow-hidden bg-neutral-100">
                  <StoryImage src={article.image} alt={article.title} />
                </div>
                <div className="flex flex-1 flex-col gap-2 p-5">
                  <time
                    dateTime={article.publishedAt}
                    className="text-xs text-foreground/50 uppercase tracking-wide"
                  >
                    {formatDate(article.publishedAt, locale)}
                  </time>
                  <h3 className="min-h-[2.75rem] text-lg font-bold leading-snug line-clamp-2 group-hover:opacity-80 transition-opacity">
                    {article.title}
                  </h3>
                  <p className="min-h-[2.5rem] flex-1 text-sm text-foreground/60 line-clamp-2">
                    {article.excerpt}
                  </p>
                  <span className="mt-auto pt-2 text-sm font-medium underline-offset-4 group-hover:underline">
                    {t("home.readMore")}
                  </span>
                </div>
              </Link>
            </article>
          ))}
        </div>
      </div>

      <Link
        href="/blogs/news"
        className="mt-6 inline-flex text-sm font-medium underline-offset-4 hover:underline sm:hidden"
      >
        {t("home.viewAllStories")}
      </Link>
    </section>
  );
}
