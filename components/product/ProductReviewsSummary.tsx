"use client";

import { ProductStarRating } from "@/components/product/ProductStarRating";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { cn } from "@/lib/utils";

type ProductReviewsSummaryProps = {
  averageRating: number;
  reviewCount: number;
  distribution: Record<1 | 2 | 3 | 4 | 5, number>;
  onWriteReview: () => void;
  className?: string;
};

export function ProductReviewsSummary({
  averageRating,
  reviewCount,
  distribution,
  onWriteReview,
  className,
}: ProductReviewsSummaryProps) {
  const { t } = useI18n();
  const maxBarCount = Math.max(1, ...Object.values(distribution));

  return (
    <aside className={cn("space-y-6", className)}>
      <div className="space-y-3">
        <p className="text-xs uppercase tracking-[0.18em] text-foreground/45">
          {t("product.reviewsSummaryTitle")}
        </p>
        <div className="flex flex-wrap items-end gap-2 sm:gap-3">
          <p className="text-4xl font-bold leading-none tracking-tight sm:text-5xl">
            {reviewCount > 0 ? averageRating.toFixed(1) : "—"}
          </p>
          <div className="space-y-1 pb-1">
            <ProductStarRating
              rating={reviewCount > 0 ? averageRating : 0}
              size="md"
            />
            <p className="text-xs text-foreground/55">
              {reviewCount > 0
                ? t("product.reviewsBasedOn", { count: reviewCount })
                : t("product.reviewsNoRatingsYet")}
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        {([5, 4, 3, 2, 1] as const).map((stars) => {
          const count = distribution[stars];
          const width = reviewCount > 0 ? `${Math.round((count / maxBarCount) * 100)}%` : "0%";
          return (
            <div key={stars} className="grid grid-cols-[2.25rem_1fr_1.75rem] items-center gap-1.5 text-xs sm:grid-cols-[3rem_1fr_2rem] sm:gap-2">
              <span className="text-foreground/60">{stars} ★</span>
              <div className="h-2 overflow-hidden rounded-pill bg-neutral-100">
                <div
                  className="h-full rounded-pill bg-[rgb(var(--color-success-text))] transition-all duration-500"
                  style={{ width }}
                />
              </div>
              <span className="text-right tabular-nums text-foreground/45">{count}</span>
            </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={onWriteReview}
        className="w-full rounded-pill bg-foreground px-5 py-3 text-sm font-medium text-background transition-opacity hover:opacity-90"
      >
        {reviewCount > 0 ? t("product.writeReview") : t("product.writeFirstReview")}
      </button>
    </aside>
  );
}


