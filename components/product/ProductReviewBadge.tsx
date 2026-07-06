"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ProductStarRating } from "@/components/product/ProductStarRating";
import {
  formatReviewCountDisplay,
  getProductReviewsHref,
} from "@/lib/product-reviews";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { Product } from "@/lib/types/product";
import { fetchLiveReviewCount } from "@/lib/woocommerce/product-reviews-api";
import { cn } from "@/lib/utils";

type ProductReviewBadgeProps = {
  product: Product;
  className?: string;
};

export function ProductReviewBadge({ product, className }: ProductReviewBadgeProps) {
  const { t } = useI18n();
  const [count, setCount] = useState(product.reviewCount ?? 0);
  const average = product.averageRating ?? 0;

  useEffect(() => {
    if (!product.wcId) return;
    let cancelled = false;
    fetchLiveReviewCount(product.wcId)
      .then((live) => {
        if (!cancelled) setCount(live);
      })
      .catch(() => {
        // Keep synced fallback from products.json.
      });
    return () => {
      cancelled = true;
    };
  }, [product.wcId, product.reviewCount]);

  const label =
    count > 0
      ? average > 0
        ? t("product.reviewsBadgeCount", {
            rating: average.toFixed(1),
            count: formatReviewCountDisplay(count),
          })
        : t("product.positiveReviews", {
            count: formatReviewCountDisplay(count),
          })
      : t("product.writeFirstReview");

  return (
    <Link
      href={getProductReviewsHref(product)}
      className={cn(
        "inline-flex items-center gap-2 text-sm text-foreground/70 transition-colors hover:text-foreground",
        className
      )}
    >
      <ProductStarRating rating={count > 0 ? average : 0} size="sm" />
      <span className="underline-offset-4 hover:underline">{label}</span>
    </Link>
  );
}
