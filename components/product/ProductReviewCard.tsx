"use client";

import { useEffect, useState } from "react";
import { ProductStarRating } from "@/components/product/ProductStarRating";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { ProductReviewRow } from "@/lib/woocommerce/product-reviews-api";
import { cn } from "@/lib/utils";

type ProductReviewCardProps = {
  review: ProductReviewRow;
};

export function ProductReviewCard({ review }: ProductReviewCardProps) {
  const { t } = useI18n();
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const initial = review.author.trim().charAt(0).toUpperCase() || "?";
  const images = review.images ?? [];

  useEffect(() => {
    if (!lightboxUrl) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setLightboxUrl(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightboxUrl]);

  return (
    <>
      <article className="rounded-card border border-border bg-white p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-sm font-semibold text-foreground/70"
            aria-hidden
          >
            {initial}
          </div>
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold">{review.author}</p>
              {review.date ? (
                <time className="text-xs text-foreground/45" dateTime={review.date}>
                  {new Date(review.date).toLocaleDateString()}
                </time>
              ) : null}
            </div>
            {review.rating > 0 ? <ProductStarRating rating={review.rating} size="sm" /> : null}
            <p className="text-sm leading-relaxed text-foreground/75">{review.content}</p>
            {images.length > 0 ? (
              <ul className="flex flex-wrap gap-2 pt-1">
                {images.map((image) => (
                  <li key={image.id}>
                    <button
                      type="button"
                      onClick={() => setLightboxUrl(image.url)}
                      className="block h-16 w-16 overflow-hidden rounded-input border border-border bg-neutral-50 transition-opacity hover:opacity-80"
                      aria-label={t("product.reviewPhotoOpen")}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={image.thumb || image.url}
                        alt=""
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
      </article>

      {lightboxUrl ? (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-[rgb(23_23_23/0.88)] p-4"
          role="dialog"
          aria-modal="true"
          aria-label={t("product.reviewPhotoOpen")}
          onClick={() => setLightboxUrl(null)}
        >
          <button
            type="button"
            onClick={() => setLightboxUrl(null)}
            className={cn(
              "absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full",
              "bg-white/10 text-white interaction-icon-hover"
            )}
            aria-label={t("common.close")}
          >
            �?          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightboxUrl}
            alt=""
            className="max-h-[90vh] max-w-full rounded-card object-contain"
            onClick={(event) => event.stopPropagation()}
          />
        </div>
      ) : null}
    </>
  );
}
