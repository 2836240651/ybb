"use client";

import Link from "next/link";
import { AddToCartButton } from "@/components/cart/AddToCartButton";
import { ProductShareRow } from "@/components/product/ProductShareRow";
import { ShopPayInstallment } from "@/components/product/ShopPayInstallment";
import { ProductReviewBadge } from "@/components/product/ProductReviewBadge";
import { StockStatusBadge } from "@/components/product/StockStatusBadge";
import { VariantOptionGrid, type VariantOption } from "@/components/product/VariantOptionGrid";
import { formatPrice, getSavePercent } from "@/lib/data/products";
import { useI18n, useProductTitle } from "@/lib/i18n/I18nProvider";
import { SITE_URL } from "@/lib/seo";
import type { Product } from "@/lib/types/product";
import { cn } from "@/lib/utils";

type ProductPurchasePanelProps = {
  product: Product;
  variant: string;
  onVariantChange: (value: string) => void;
  variantOptions: readonly VariantOption[];
  variantLabel?: string;
  quantity?: number;
  onQuantityChange?: (quantity: number) => void;
  brandLabel?: string;
  /** Resolved purchase-area slogan (visible + text). */
  purchaseSlogan?: { visible: boolean; text: string };
  /** @deprecated use purchaseSlogan */
  description?: string;
  showQuantity?: boolean;
  headingLevel?: "h1" | "h2";
  headingId?: string;
  detailsHref?: string;
  wholesaleLink?: boolean;
};

export function ProductPurchasePanel({
  product,
  variant,
  onVariantChange,
  variantOptions,
  variantLabel = "Pack",
  quantity = 1,
  onQuantityChange,
  brandLabel = "YBB Tackle",
  purchaseSlogan,
  description,
  showQuantity = true,
  headingLevel = "h1",
  headingId,
  detailsHref,
  wholesaleLink = true,
}: ProductPurchasePanelProps) {
  const { t } = useI18n();
  const localizedTitle = useProductTitle(product);
  const productShareUrl = `${SITE_URL.replace(/\/$/, "")}/products/${product.handle}`;
  const Heading = headingLevel;
  const onSale =
    product.compareAtPrice != null &&
    product.compareAtPrice > product.price;
  const savePercent = onSale
    ? getSavePercent(product.price, product.compareAtPrice!)
    : 0;

  const defaultDescription = t("product.defaultDescription");
  const sloganText =
    purchaseSlogan?.visible === false
      ? null
      : purchaseSlogan?.text ?? description ?? defaultDescription;

  return (
    <div className="flex flex-col gap-4 md:gap-5 lg:gap-6">
      <div className="product__purchase-header space-y-4 md:space-y-5">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-foreground/50 mb-3 md:mb-4">
            {brandLabel}
          </p>
          <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between lg:gap-4">
            <Heading
              id={headingId}
              className={cn(
                "font-bold flex-1 min-w-0",
                headingLevel === "h1"
                  ? "text-2xl sm:text-3xl lg:text-[2.5rem] tracking-tight leading-[1.25] lg:leading-none lg:max-w-[27rem]"
                  : "text-title-md leading-[1.25] lg:leading-none"
              )}
            >
              {localizedTitle}
            </Heading>
            <div className="shrink-0 sm:text-right lg:text-right">
              <p className="text-xl font-bold md:text-2xl max-sm:whitespace-normal sm:whitespace-nowrap">
                {formatPrice(product.price)}
              </p>
              {onSale && (
                <p className="text-sm text-foreground/40 line-through">
                  {formatPrice(product.compareAtPrice!)}
                </p>
              )}
            </div>
          </div>
          {onSale && (
            <span className="mt-2 inline-block rounded-pill bg-sale text-sale-foreground px-3 py-1 text-xs font-medium uppercase">
              {t("product.savePercent", { percent: savePercent })}
            </span>
          )}
          {product.sku && (
            <p className="mt-3 text-sm text-foreground/55">
              <span className="font-medium text-foreground/70">{t("product.skuLabel")}</span>{" "}
              <span className="font-mono tracking-wide">{product.sku}</span>
            </p>
          )}
        </div>

        <ShopPayInstallment price={product.price} />
      </div>

      <VariantOptionGrid
        label={variantLabel === "Pack" ? t("product.pack") : variantLabel}
        options={variantOptions}
        value={variant}
        onChange={onVariantChange}
      />

      {showQuantity && onQuantityChange && (
        <div className="space-y-2">
          <span className="text-sm font-medium">{t("common.quantity")}</span>
          <div className="inline-flex items-center rounded-input border border-border">
            <button
              type="button"
              className="px-4 py-3 text-sm hover:bg-neutral-50 transition-colors"
              aria-label={t("common.decreaseQuantity")}
              onClick={() => onQuantityChange(Math.max(1, quantity - 1))}
            >
              �?            </button>
            <span className="min-w-[3rem] text-center text-sm">{quantity}</span>
            <button
              type="button"
              className="px-4 py-3 text-sm hover:bg-neutral-50 transition-colors"
              aria-label={t("common.increaseQuantity")}
              onClick={() => onQuantityChange(quantity + 1)}
            >
              +
            </button>
          </div>
        </div>
      )}

      <div className="space-y-4">
        <StockStatusBadge available={product.available} />

        <AddToCartButton
          product={product}
          variant={variant}
          quantity={quantity}
          label={t("product.addToCart")}
          showPriceInLabel
          size="lg"
          fullWidth
        />

        <ProductReviewBadge product={product} />

        <p className="flex items-center gap-2 text-sm text-foreground/60">
          <svg
            viewBox="0 0 24 24"
            className="h-4 w-4 shrink-0"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden
          >
            <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2" />
            <path d="M15 18H9" />
            <path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.684-.948l-1.923-.641a1 1 0 0 1-.578-.502l-1.539-3.076A1 1 0 0 0 15.382 8H14" />
            <circle cx="7" cy="18" r="2" />
            <circle cx="17" cy="18" r="2" />
          </svg>
          {t("product.shipsWithin")}
        </p>
      </div>

      {sloganText ? (
        <p className="text-sm text-foreground/60 leading-relaxed">{sloganText}</p>
      ) : null}

      {wholesaleLink && (
        <p className="text-sm text-foreground/50">
          {t("product.wholesaleOem")}{" "}
          <Link
            href="/pages/contact"
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            {t("product.contactTeam")}
          </Link>
        </p>
      )}

      <div className="border-t border-border pt-5 space-y-4">
        <ProductShareRow
          productTitle={localizedTitle}
          productUrl={productShareUrl}
        />
        {detailsHref && (
          <Link
            href={detailsHref}
            className={cn(
              "inline-flex items-center gap-2 text-sm font-medium",
              "underline-offset-4 hover:underline"
            )}
          >
            {t("product.viewFullDetails")}
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M5 12h14M13 5l7 7-7 7" />
            </svg>
          </Link>
        )}
      </div>
    </div>
  );
}
