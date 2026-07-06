"use client";

import { useI18n } from "@/lib/i18n/I18nProvider";
import { cn } from "@/lib/utils";

type CarouselArrowsProps = {
  onPrev: () => void;
  onNext: () => void;
  prevDisabled?: boolean;
  nextDisabled?: boolean;
  className?: string;
};

function ArrowIcon({ direction }: { direction: "left" | "right" }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
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

export function CarouselArrows({
  onPrev,
  onNext,
  prevDisabled,
  nextDisabled,
  className,
}: CarouselArrowsProps) {
  const { t } = useI18n();
  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <button
        type="button"
        onClick={onPrev}
        disabled={prevDisabled}
        aria-label={t("common.previous")}
        className={cn(
          "inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-[#171717] text-white interaction-carousel-arrow",
          "transition-transform duration-300 ease-primary hover:scale-[1.05] active:scale-[0.96]",
          "disabled:opacity-30 disabled:pointer-events-none"
        )}
      >
        <ArrowIcon direction="left" />
      </button>
      <button
        type="button"
        onClick={onNext}
        disabled={nextDisabled}
        aria-label={t("common.next")}
        className={cn(
          "inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-[#171717] text-white interaction-carousel-arrow",
          "transition-transform duration-300 ease-primary hover:scale-[1.05] active:scale-[0.96]",
          "disabled:opacity-30 disabled:pointer-events-none"
        )}
      >
        <ArrowIcon direction="right" />
      </button>
    </div>
  );
}
