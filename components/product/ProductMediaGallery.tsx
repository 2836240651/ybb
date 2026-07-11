"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type ProductMediaGalleryProps = {
  images: string[];
  alt: string;
  priority?: boolean;
  defaultIndex?: number;
  enabled?: boolean;
};

function ChevronIcon({ direction }: { direction: "left" | "right" }) {
  const path = direction === "left" ? "M15 18l-6-6 6-6" : "M9 18l6-6-6-6";
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
      aria-hidden
    >
      <path d={path} />
    </svg>
  );
}

type ThumbnailStripProps = {
  images: string[];
  activeIndex: number;
  onSelect: (index: number) => void;
  orientation: "vertical" | "horizontal";
  className?: string;
};

function ThumbnailStrip({
  images,
  activeIndex,
  onSelect,
  orientation,
  className,
}: ThumbnailStripProps) {
  const thumbRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    const active = thumbRefs.current[activeIndex];
    active?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "center",
    });
  }, [activeIndex, images.length]);

  return (
    <div
      className={cn(
        "product__thumbnails",
        orientation === "vertical"
          ? "product__thumbnails--beside flex w-20 shrink-0 flex-col"
          : "product__thumbnails--below w-full"
      )}
    >
      <div
        className={cn(
          "product__thumbnails-list scroll-area",
          orientation === "vertical"
            ? "flex flex-col gap-4 overflow-y-auto overscroll-contain max-h-[min(80vh,40rem)] scrollbar-thin pr-0.5"
            : "flex gap-4 overflow-x-auto overscroll-x-contain pb-0.5 scrollbar-thin",
          className
        )}
        aria-label="Product thumbnails"
      >
        {images.map((src, i) => (
          <button
            key={`thumb-${i}-${src}`}
            ref={(el) => {
              thumbRefs.current[i] = el;
            }}
            type="button"
            data-gallery-index={i}
            onClick={() => onSelect(i)}
            aria-label={`View image ${i + 1} of ${images.length}`}
            aria-current={activeIndex === i ? "true" : undefined}
            className={cn(
              "product__thumbnail relative shrink-0 overflow-hidden rounded-[10px]",
              "aspect-square w-20 transition-[opacity,box-shadow] duration-300 ease-primary",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-1",
              activeIndex === i
                ? "ring-2 ring-foreground ring-offset-1 opacity-100"
                : "opacity-60 hover:opacity-100"
            )}
          >
            <Image
              src={src}
              alt=""
              fill
              sizes="80px"
              className="rounded-[10px] object-contain p-1 mix-blend-multiply pointer-events-none"
              aria-hidden
            />
          </button>
        ))}
      </div>
    </div>
  );
}

function MainImage({
  src,
  alt,
  index,
  priority,
  showArrows,
  onPrev,
  onNext,
}: {
  src: string;
  alt: string;
  index: number;
  priority?: boolean;
  showArrows?: boolean;
  onPrev?: () => void;
  onNext?: () => void;
}) {
  return (
    <div className="product__media-main relative aspect-square overflow-hidden rounded-card">
      <Image
        key={`${index}-${src}`}
        src={src}
        alt={alt}
        fill
        data-gallery-index={index}
        sizes="(max-width: 1024px) calc(100vw - 5rem), 45vw"
        className="rounded-card object-contain p-4 md:p-6 mix-blend-multiply transition-opacity duration-500 ease-primary"
        priority={priority && index === 0}
      />

      {showArrows && onPrev && onNext && (
        <>
          <button
            type="button"
            onClick={onPrev}
            aria-label="Previous image"
            className={cn(
              "absolute left-3 top-1/2 -translate-y-1/2",
              "flex h-10 w-10 items-center justify-center rounded-full",
              "bg-white/90 text-foreground shadow-sm",
              "transition-[background-color,transform] duration-300 ease-primary",
              "hover:bg-white hover:scale-105"
            )}
          >
            <ChevronIcon direction="left" />
          </button>
          <button
            type="button"
            onClick={onNext}
            aria-label="Next image"
            className={cn(
              "absolute right-3 top-1/2 -translate-y-1/2",
              "flex h-10 w-10 items-center justify-center rounded-full",
              "bg-white/90 text-foreground shadow-sm",
              "transition-[background-color,transform] duration-300 ease-primary",
              "hover:bg-white hover:scale-105"
            )}
          >
            <ChevronIcon direction="right" />
          </button>
        </>
      )}
    </div>
  );
}

/** PDP gallery: hero image on top + bottom thumbnail strip */
export function ProductMediaGallery({
  images,
  alt,
  priority = false,
  defaultIndex = 0,
  enabled = true,
}: ProductMediaGalleryProps) {
  const safeImages = images.length > 0 ? images : ["/images/placeholder-product.webp"];
  const imagesKey = safeImages.join("\u0000");
  const clampedDefault =
    defaultIndex >= 0 && defaultIndex < safeImages.length ? defaultIndex : 0;

  const [activeIndex, setActiveIndex] = useState(clampedDefault);
  const imagesKeyRef = useRef(imagesKey);

  const showThumbnails = enabled && safeImages.length >= 1;
  const hasMultiple = safeImages.length > 1;

  useEffect(() => {
    if (imagesKeyRef.current !== imagesKey) {
      imagesKeyRef.current = imagesKey;
      setActiveIndex(clampedDefault);
      return;
    }
    setActiveIndex((current) =>
      current >= 0 && current < safeImages.length ? current : clampedDefault
    );
  }, [clampedDefault, imagesKey, safeImages.length]);

  const selectImage = useCallback((index: number) => {
    setActiveIndex(index);
  }, []);

  const goPrev = useCallback(() => {
    setActiveIndex((i) => (i === 0 ? safeImages.length - 1 : i - 1));
  }, [safeImages.length]);

  const goNext = useCallback(() => {
    setActiveIndex((i) => (i === safeImages.length - 1 ? 0 : i + 1));
  }, [safeImages.length]);

  return (
    <div
      className="product__media card media media--adapt_first flex w-full shrink-0 relative"
      data-gallery-layout="bottom-strip"
      data-gallery-count={safeImages.length}
      data-gallery-active={activeIndex}
    >
      <div className="product__media-all flex w-full flex-col gap-4">
        <div className="relative min-w-0 flex-1">
          <MainImage
            src={safeImages[activeIndex]!}
            alt={alt}
            index={activeIndex}
            priority={priority}
            showArrows={hasMultiple}
            onPrev={goPrev}
            onNext={goNext}
          />
        </div>

        {showThumbnails && (
          <ThumbnailStrip
            images={safeImages}
            activeIndex={activeIndex}
            onSelect={selectImage}
            orientation="horizontal"
          />
        )}
      </div>
    </div>
  );
}
