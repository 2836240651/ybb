"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { resolveTriLabel } from "@/lib/site-manager/labels";
import { useYbbHero, type HeroSlide } from "@/lib/site-manager/hero-api";
import { cn } from "@/lib/utils";
import { useEmblaWithAutoplay } from "@/lib/hooks/useEmblaCarousel";

const FALLBACK_SLIDES: HeroSlide[] = [
  {
    id: "factory-catalog",
    href: "/pages/wholesale",
    imageUrl: "/images/hero/hero-01.webp",
  },
  {
    id: "ready-rigs",
    href: "/collections/all",
    imageUrl: "/images/hero/hero-02.webp",
  },
  {
    id: "bait-cages",
    href: "/pages/oem-odm",
    imageUrl: "/images/hero/hero-03.webp",
  },
  {
    id: "oem",
    href: "/pages/contact",
    imageUrl: "/images/hero/hero-04.webp",
  },
];

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://carp-ybb.com";

function toHeroImageSrc(url: string): string {
  const base = SITE.replace(/\/$/, "");
  if (url.startsWith(base)) return url.slice(base.length) || "/";
  return url.startsWith("/") ? url : `/${url}`;
}

type CaptionPhase = "idle" | "exit" | "enter";

const CAPTION_EXIT_WAIT_MS = 500;
const CAPTION_WORD_STAGGER_MS = 30;
const CAPTION_DURATION_MS = 1000;

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

function countWords(text: string) {
  return text.split(/\s+/).filter(Boolean).length;
}

/** OMC slideshow-words: split-words + animate-element fade-up-large */
function HeroAnimatedCaption({
  slides,
  selectedIndex,
  getTitle,
}: {
  slides: HeroSlide[];
  selectedIndex: number;
  getTitle: (slide: HeroSlide) => string;
}) {
  const reducedMotion = usePrefersReducedMotion();
  const [displayIndex, setDisplayIndex] = useState(selectedIndex);
  const [phase, setPhase] = useState<CaptionPhase>("idle");
  const displayIndexRef = useRef(displayIndex);
  const timersRef = useRef<number[]>([]);

  useEffect(() => {
    displayIndexRef.current = displayIndex;
  }, [displayIndex]);

  useEffect(() => {
    timersRef.current.forEach((id) => window.clearTimeout(id));
    timersRef.current = [];

    if (selectedIndex === displayIndexRef.current) return;

    if (reducedMotion) {
      setDisplayIndex(selectedIndex);
      setPhase("idle");
      return;
    }

    const exitingIndex = displayIndexRef.current;
    const exitWordCount = countWords(getTitle(slides[exitingIndex]));

    setPhase("exit");

    const switchTimer = window.setTimeout(() => {
      setDisplayIndex(selectedIndex);
      setPhase("enter");

      const enterWordCount = countWords(getTitle(slides[selectedIndex]));
      const idleTimer = window.setTimeout(
        () => setPhase("idle"),
        CAPTION_DURATION_MS + CAPTION_WORD_STAGGER_MS * enterWordCount
      );
      timersRef.current.push(idleTimer);
    }, CAPTION_EXIT_WAIT_MS + CAPTION_WORD_STAGGER_MS * exitWordCount);

    timersRef.current.push(switchTimer);

    return () => {
      timersRef.current.forEach((id) => window.clearTimeout(id));
      timersRef.current = [];
    };
  }, [selectedIndex, reducedMotion, getTitle, slides]);

  return (
    <nav
      className="hero-banner__captions w-full"
      aria-live="polite"
      aria-atomic="true"
    >
      {slides.map((slide, i) => {
        const title = getTitle(slide);
        const words = title.split(/\s+/).filter(Boolean);
        const isDisplayed = i === displayIndex;
        const captionPhase = isDisplayed ? phase : "idle";

        return (
          <h2
            key={slide.id}
            className={cn(
              "hero-banner__caption text-hero-caption text-white max-w-3xl",
              isDisplayed
                ? "hero-banner__caption--current"
                : "hero-banner__caption--hidden",
              captionPhase === "exit" && "hero-banner__caption--exit",
              captionPhase === "enter" && "hero-banner__caption--enter"
            )}
            aria-hidden={!isDisplayed}
          >
            {words.map((word, wordIndex) => (
              <span
                key={`${slide.id}-${wordIndex}`}
                className="hero-banner__caption-word"
                style={{ "--word-index": wordIndex } as CSSProperties}
              >
                <span className="hero-banner__caption-word-inner">
                  {word}
                </span>
                {wordIndex < words.length - 1 ? "\u00a0" : null}
              </span>
            ))}
          </h2>
        );
      })}
    </nav>
  );
}

/** OMC: banner > banner__media (top radius + extra height) > animate-element zoom-out */
function HeroSlideBackground({
  src,
  alt,
  isActive,
  priority,
}: {
  src: string;
  alt: string;
  isActive: boolean;
  priority?: boolean;
}) {
  const [animTick, setAnimTick] = useState(0);

  useEffect(() => {
    if (isActive) setAnimTick((t) => t + 1);
  }, [isActive]);

  return (
    <div className="hero-banner absolute inset-0 overflow-hidden">
      <div className="hero-banner__media">
        <div
          key={animTick}
          className={cn(
            "hero-banner__animate",
            isActive ? "hero-slide-zoom-active" : "hero-slide-zoom-idle"
          )}
        >
          <Image
            src={src}
            alt={alt}
            fill
            sizes="(max-width: 1024px) 100vw, 1759px"
            className="object-cover object-center"
            priority={priority}
          />
        </div>
      </div>
    </div>
  );
}

function ArrowIcon({ direction }: { direction: "left" | "right" }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {direction === "left" ? (
        <path d="M15 18l-6-6 6-6" />
      ) : (
        <path d="M9 18l6-6-6-6" />
      )}
    </svg>
  );
}

const heroArrowClass =
  "inline-flex h-8 w-8 items-center justify-center text-white transition-opacity duration-500 ease-primary hover:opacity-80 active:scale-[0.96]";

function HeroSlideDots({
  count,
  selectedIndex,
  onSelect,
  ariaLabel,
}: {
  count: number;
  selectedIndex: number;
  onSelect: (index: number) => void;
  ariaLabel: string;
}) {
  return (
    <div
      className="flex items-center justify-center gap-0"
      role="tablist"
      aria-label={ariaLabel}
    >
      {Array.from({ length: count }, (_, i) => (
        <button
          key={i}
          type="button"
          role="tab"
          aria-selected={i === selectedIndex}
          aria-label={`Page ${i + 1}`}
          onClick={() => onSelect(i)}
          className="hero-dot flex h-6 w-6 items-center justify-center rounded-full transition-[box-shadow] duration-500 ease-primary"
        >
          <span
            className={cn(
              "hero-dot__inner block h-[5px] w-[5px] rounded-full transition-all duration-500 ease-primary",
              i === selectedIndex
                ? "bg-transparent shadow-[0_0_0_2px_white]"
                : "bg-white"
            )}
          />
        </button>
      ))}
    </div>
  );
}

export function HeroCarousel() {
  const { t, locale } = useI18n();
  const { slides, autoplayMs, enabled, ready } = useYbbHero(FALLBACK_SLIDES);
  const {
    emblaRef,
    selectedIndex,
    scrollPrev,
    scrollNext,
    scrollTo,
    paused,
    togglePause,
  } = useEmblaWithAutoplay({
    emblaOptions: {
      align: "start",
      containScroll: "trimSnaps",
      loop: true,
      dragFree: false,
      duration: 35,
    },
    autoplayDelay: autoplayMs,
    pauseOnHover: true,
  });

  const getTitle = useCallback(
    (slide: HeroSlide) => {
      const fromRest = resolveTriLabel(slide.labels, locale, "");
      if (fromRest) return fromRest;
      return t(`hero.${slide.id}.title`);
    },
    [locale, t]
  );

  if (ready && (!enabled || !slides.length)) return null;

  return (
    <section
      aria-label={t("hero.slideshow")}
      className="relative w-full slideshow overflow-x-clip"
      aria-roledescription="carousel"
    >
      <h1 className="sr-only">YBB Tackle �?Wholesale Terminal Tackle Factory</h1>

      <div ref={emblaRef} className="hero-slideshow-viewport overflow-hidden">
        <div className="flex touch-pan-y pl-[var(--gap-padding)]">
          {slides.map((slide, i) => {
            const title = getTitle(slide);
            const imageSrc = toHeroImageSrc(slide.imageUrl);
            return (
              <div
                key={slide.id}
                className="hero-slide shrink-0 grow-0 basis-[calc(100%-var(--gap-padding)*2)] mr-[var(--hero-slide-gap)]"
                aria-hidden={i !== selectedIndex}
              >
                <div className="hero-banner relative w-full aspect-[1759/638] overflow-hidden">
                  <HeroSlideBackground
                    src={imageSrc}
                    alt={title}
                    isActive={i === selectedIndex}
                    priority={i === 0}
                  />
                  <div className="hero-banner__overlay absolute inset-0 pointer-events-none" aria-hidden />
                  <Link
                    href={slide.href}
                    className="absolute inset-0 z-[1]"
                    aria-label={title}
                    tabIndex={i === selectedIndex ? 0 : -1}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* OMC slideshow-words: centered bottom caption with fade-up-large word stagger */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 z-10 overflow-x-clip px-[var(--gap-padding)]"
        style={{ paddingBottom: "var(--hero-caption-offset)" }}
      >
        <HeroAnimatedCaption
          slides={slides}
          selectedIndex={selectedIndex}
          getTitle={getTitle}
        />
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 px-[var(--gap-padding)] pb-5 md:pb-6">
        <div className="relative flex items-end justify-between gap-4 pointer-events-auto min-h-[4.5rem]">
          <button
            type="button"
            onClick={scrollPrev}
            aria-label={t("hero.previousSlide")}
            className={cn(heroArrowClass, "hidden md:inline-flex")}
          >
            <ArrowIcon direction="left" />
          </button>

          <div className="absolute left-1/2 bottom-0 -translate-x-1/2">
            <HeroSlideDots
              count={slides.length}
              selectedIndex={selectedIndex}
              onSelect={scrollTo}
              ariaLabel={t("hero.slidePages")}
            />
          </div>

          <div className="flex items-center gap-3 ml-auto">
            <button
              type="button"
              onClick={scrollNext}
              aria-label={t("hero.nextSlide")}
              className={cn(heroArrowClass, "hidden md:inline-flex")}
            >
              <ArrowIcon direction="right" />
            </button>

            <button
              type="button"
              onClick={togglePause}
              className="sr-only"
              aria-pressed={paused}
            >
              {paused ? t("hero.playSlideshow") : t("hero.pauseSlideshow")}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
