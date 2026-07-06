"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { ProductReviewCard } from "@/components/product/ProductReviewCard";
import { ProductReviewsSummary } from "@/components/product/ProductReviewsSummary";
import { ProductStarRating } from "@/components/product/ProductStarRating";
import { WriteReviewModal } from "@/components/product/WriteReviewModal";
import { formatReviewCountDisplay } from "@/lib/product-reviews";
import { useI18n, useProductTitle } from "@/lib/i18n/I18nProvider";
import type { Product } from "@/lib/types/product";
import {
  fetchProductReviews,
  productReviewFormEmbedUrl,
  type ProductReviewRow,
  type ProductReviewsPayload,
} from "@/lib/woocommerce/product-reviews-api";

type ProductReviewsSectionProps = {
  product: Product;
  collectionTitle?: string;
};

type StarDistribution = Record<1 | 2 | 3 | 4 | 5, number>;

function buildDistribution(reviews: ProductReviewRow[]): StarDistribution {
  const distribution: StarDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const review of reviews) {
    const stars = Math.max(1, Math.min(5, Math.round(review.rating))) as 1 | 2 | 3 | 4 | 5;
    distribution[stars] += 1;
  }
  return distribution;
}

export function ProductReviewsSection({
  product,
  collectionTitle,
}: ProductReviewsSectionProps) {
  const { t } = useI18n();
  const productTitle = useProductTitle(product);
  const [payload, setPayload] = useState<ProductReviewsPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [writeOpen, setWriteOpen] = useState(false);

  const refreshReviews = () => {
    if (!product.wcId) return;
    fetchProductReviews(product.wcId)
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
    fetchProductReviews(product.wcId)
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
  const distribution = useMemo(
    () => buildDistribution(payload?.reviews ?? []),
    [payload?.reviews]
  );
  const heroImage = product.images[0];

  return (
    <>
      <div className="page-container py-8 md:py-10 lg:py-14">
        <nav className="mb-6 min-w-0 text-sm text-foreground/50" aria-label="Breadcrumb">
          <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 break-words">
            <li>
              <Link href="/" className="hover:opacity-70">
                {t("common.home")}
              </Link>
            </li>
            <li aria-hidden>/</li>
            <li>
              <Link
                href={`/collections/${product.collection}`}
                className="hover:opacity-70"
              >
                {collectionTitle ?? product.collection.replace(/-/g, " ")}
              </Link>
            </li>
            <li aria-hidden>/</li>
            <li>
              <Link href={`/products/${product.handle}`} className="hover:opacity-70">
                {productTitle}
              </Link>
            </li>
            <li aria-hidden>/</li>
            <li className="text-foreground">{t("product.reviewsPageTitle")}</li>
          </ol>
        </nav>

        <div className="overflow-hidden rounded-card border border-border bg-white shadow-[0_20px_60px_rgb(0_0_0/0.08)]">
          <div className="border-b border-border bg-neutral-50/80 px-4 py-4 sm:px-5 sm:py-5 md:px-8 md:py-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex min-w-0 items-center gap-3 sm:gap-4">
                {heroImage ? (
                  <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-card bg-neutral-100">
                    <Image
                      src={heroImage}
                      alt=""
                      fill
                      className="object-cover"
                      sizes="64px"
                    />
                  </div>
                ) : null}
                <div className="min-w-0 space-y-1">
                  <p className="text-xs uppercase tracking-[0.18em] text-foreground/45">
                    {t("product.reviewsEyebrow")}
                  </p>
                  <h1 className="break-words text-xl font-bold tracking-tight md:text-2xl">{productTitle}</h1>
                  {reviewCount > 0 ? (
                    <p className="flex flex-wrap items-center gap-2 text-sm text-foreground/60">
                      <ProductStarRating rating={averageRating} size="sm" />
                      <span>
                        {averageRating.toFixed(1)} ·{" "}
                        {t("product.positiveReviews", {
                          count: formatReviewCountDisplay(reviewCount),
                        })}
                      </span>
                    </p>
                  ) : null}
                </div>
              </div>
              <Link
                href={`/products/${product.handle}`}
                className="inline-flex text-sm font-medium underline-offset-4 hover:underline"
              >
                {t("product.backToProduct")}
              </Link>
            </div>
          </div>

          <div className="grid gap-6 px-4 py-5 sm:gap-8 sm:px-5 sm:py-6 md:px-8 md:py-8 lg:grid-cols-[minmax(240px,280px)_1fr] lg:gap-10">
            <ProductReviewsSummary
              averageRating={averageRating}
              reviewCount={reviewCount}
              distribution={distribution}
              onWriteReview={() => setWriteOpen(true)}
            />

            <section className="min-w-0 space-y-4">
              <div className="flex items-center justify-between gap-3 border-b border-border pb-4">
                <h2 className="text-lg font-semibold">{t("product.reviewsListTitle")}</h2>
                {reviewCount > 0 ? (
                  <span className="text-xs text-foreground/45">
                    {t("product.reviewsBasedOn", { count: reviewCount })}
                  </span>
                ) : null}
              </div>

              {loading ? (
                <div className="space-y-3">
                  <div className="h-24 animate-pulse rounded-card bg-neutral-100" />
                  <div className="h-24 animate-pulse rounded-card bg-neutral-100" />
                </div>
              ) : null}

              {error ? (
                <p className="rounded-card border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {t("product.reviewsLoadError")}
                </p>
              ) : null}

              {!loading && !error && reviewCount === 0 ? (
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
              ) : null}

              {!loading && !error && payload?.reviews?.length ? (
                <ul className="space-y-4">
                  {payload.reviews.map((review) => (
                    <li key={review.id}>
                      <ProductReviewCard review={review} />
                    </li>
                  ))}
                </ul>
              ) : null}
            </section>
          </div>
        </div>
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
