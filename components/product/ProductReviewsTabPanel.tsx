"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ProductReviewCard } from "@/components/product/ProductReviewCard";
import { ProductStarRating } from "@/components/product/ProductStarRating";
import { WriteReviewModal } from "@/components/product/WriteReviewModal";
import { getProductReviewsHref } from "@/lib/product-reviews";
import { useI18n, useProductTitle } from "@/lib/i18n/I18nProvider";
import type { Product } from "@/lib/types/product";
import {
  fetchProductReviews,
  PDP_REVIEWS_TAB_LIMIT,
  productReviewFormEmbedUrl,
  type ProductReviewsPayload,
} from "@/lib/woocommerce/product-reviews-api";

type ProductReviewsTabPanelProps = {
  product: Product;
};

export function ProductReviewsTabPanel({ product }: ProductReviewsTabPanelProps) {
  const { t } = useI18n();
  const productTitle = useProductTitle(product);
  const [payload, setPayload] = useState<ProductReviewsPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [writeOpen, setWriteOpen] = useState(false);

  const refreshReviews = () => {
    if (!product.wcId) return;
    fetchProductReviews(product.wcId, { limit: PDP_REVIEWS_TAB_LIMIT })
      .then(setPayload)
      .catch((err) => {
        setError(err instanceof Error ? err.message : String(err));
      });
  };

  useEffect(() => {
    if (!product.wcId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchProductReviews(product.wcId, { limit: PDP_REVIEWS_TAB_LIMIT })
      .then((data) => {
        if (!cancelled) setPayload(data);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [product.wcId]);

  const reviewCount = payload?.review_count ?? product.reviewCount ?? 0;
  const averageRating = payload?.average_rating ?? product.averageRating ?? 0;
  const embedUrl = product.wcId ? productReviewFormEmbedUrl(product.wcId) : null;
  const reviews = payload?.reviews ?? [];
  const showViewAll = reviewCount > PDP_REVIEWS_TAB_LIMIT;

  if (loading) {
    return (
      <div className="space-y-3" aria-busy="true">
        <div className="h-16 animate-pulse rounded-card bg-neutral-100" />
        <div className="h-24 animate-pulse rounded-card bg-neutral-100" />
        <div className="h-24 animate-pulse rounded-card bg-neutral-100" />
      </div>
    );
  }

  if (error) {
    return (
      <p className="rounded-card border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        {t("product.reviewsLoadError")}
      </p>
    );
  }

  if (reviewCount === 0) {
    return (
      <>
        <div className="rounded-card border border-dashed border-border bg-neutral-50 px-6 py-10 text-center">
          <ProductStarRating rating={0} size="lg" className="justify-center opacity-30" />
          <p className="mt-4 text-base font-medium">{t("product.reviewsEmptyTitle")}</p>
          <p className="mt-2 text-sm text-foreground/60">{t("product.reviewsEmpty")}</p>
          <button
            type="button"
            onClick={() => setWriteOpen(true)}
            className="mt-6 inline-flex rounded-pill bg-foreground px-6 py-3 text-sm font-medium text-background transition-opacity hover:opacity-90"
          >
            {t("product.writeFirstReview")}
          </button>
        </div>
        <WriteReviewModal
          open={writeOpen}
          onClose={() => setWriteOpen(false)}
          onSubmitted={refreshReviews}
          embedUrl={embedUrl}
          productTitle={productTitle}
        />
      </>
    );
  }

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end gap-3 border-b border-border pb-5">
        <p className="text-3xl font-bold leading-none tracking-tight">
          {averageRating.toFixed(1)}
        </p>
        <div className="space-y-1 pb-0.5">
          <ProductStarRating rating={averageRating} size="md" />
          <p className="text-xs text-foreground/55">
            {t("product.reviewsBasedOn", { count: reviewCount })}
          </p>
        </div>
      </div>

      <ul className="space-y-4">
        {reviews.map((review) => (
          <li key={review.id}>
            <ProductReviewCard review={review} />
          </li>
        ))}
      </ul>

      <div className="mt-6 flex flex-wrap items-center gap-4">
        {showViewAll ? (
          <Link
            href={getProductReviewsHref(product)}
            className="text-sm font-medium underline-offset-4 hover:underline"
          >
            {t("product.viewAllReviews")}
          </Link>
        ) : null}
        <button
          type="button"
          onClick={() => setWriteOpen(true)}
          className="inline-flex rounded-pill border border-border px-5 py-2.5 text-sm font-medium transition-colors hover:bg-neutral-50"
        >
          {t("product.writeReview")}
        </button>
      </div>

      <WriteReviewModal
        open={writeOpen}
        onClose={() => setWriteOpen(false)}
        onSubmitted={refreshReviews}
        embedUrl={embedUrl}
        productTitle={productTitle}
      />
    </>
  );
}
