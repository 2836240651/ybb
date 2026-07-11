"use client";

import Image from "next/image";
import Link from "next/link";
import { IconEye } from "@/components/icons/IconEye";
import { ScrollReveal } from "@/components/motion/ScrollReveal";
import { formatPrice, formatProductListPrice, getSavePercent } from "@/lib/data/products";
import { useI18n, useProductTitle } from "@/lib/i18n/I18nProvider";
import { useUI } from "@/lib/store/ui";
import type { Product } from "@/lib/types/product";
import { PLACEHOLDER_PRODUCT_IMAGE, resolveProductImage } from "@/lib/data/asset-paths";
import { cn } from "@/lib/utils";

type ProductCardProps = {
  product: Product;
  className?: string;
  priority?: boolean;
  showQuickView?: boolean;
  imageAspect?: "portrait" | "square";
  imageFit?: "contain" | "cover";
  showMoqHint?: boolean;
  revealIndex?: number;
};

export function ProductCard({
  product,
  className,
  priority,
  showQuickView = true,
  imageAspect = "square",
  imageFit = "contain",
  showMoqHint = false,
  revealIndex = 0,
}: ProductCardProps) {
  const { openQuickView } = useUI();
  const { t } = useI18n();
  const title = useProductTitle(product);
  const onSale =
    product.compareAtPrice != null &&
    product.compareAtPrice > product.price;
  const savePercent = onSale
    ? getSavePercent(product.price, product.compareAtPrice!)
    : 0;
  const soldOut = !product.available;
  const imageSrc = resolveProductImage(product.images, product.handle);

  return (
    <article className={cn("product-card group relative flex flex-col", className)}>
      <div className="product-card__media-shell rounded-card">
      <div
        className={cn(
          "product-card__media relative rounded-card",
          imageAspect === "square" ? "aspect-square" : "aspect-[4/5]"
        )}
      >
        <Link
          href={`/products/${product.handle}.html`}
          prefetch={false}
          className="absolute inset-0 z-0 block overflow-hidden rounded-card"
          aria-label={title}
        >
          <Image
            src={imageSrc}
            alt={title}
            fill
            sizes="(max-width: 768px) 45vw, (max-width: 1280px) 25vw, 16vw"
            className={cn(
              "rounded-card object-center p-3 sm:p-4 mix-blend-multiply transition-transform duration-500 ease-primary group-hover:scale-[1.02]",
              imageFit === "cover" ? "object-cover" : "object-contain"
            )}
            priority={priority}
            onError={(e) => {
              const img = e.currentTarget;
              const src = img.currentSrc || img.src;
              const master = `/products/${product.handle}/master.webp`;
              const woo = product.images?.find(
                (url) => url && url !== PLACEHOLDER_PRODUCT_IMAGE
              );
              if (woo && !src.includes(encodeURI(woo)) && !src.endsWith(woo)) {
                img.src = woo;
                return;
              }
              if (!src.endsWith(master)) {
                img.src = master;
                return;
              }
              if (!src.endsWith(PLACEHOLDER_PRODUCT_IMAGE)) {
                img.src = PLACEHOLDER_PRODUCT_IMAGE;
              }
            }}
          />
        </Link>

        {onSale && (
          <span className="absolute top-3 left-3 z-10 rounded-pill bg-sale text-sale-foreground px-3 py-1 text-[11px] font-semibold uppercase tracking-wide">
            {t("product.savePercent", { percent: savePercent })}
          </span>
        )}

        {soldOut && (
          <span className="product-card-badge product-card-badge--sold-out absolute top-3 right-3 z-10 md:top-5 md:right-5">
            {t("product.soldOut")}
          </span>
        )}

        {showQuickView && !soldOut && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              openQuickView(product.handle);
            }}
            className="product-card-quick-view absolute top-3 right-3 z-20 flex items-center justify-center md:top-4 md:right-4"
            aria-label={t("product.quickView")}
          >
            <IconEye className="h-5 w-5" />
          </button>
        )}
      </div>
      </div>

      <ScrollReveal animate="fade-up" staggerIndex={revealIndex} delay={60}>
      <Link
        href={`/products/${product.handle}.html`}
        prefetch={false}
        className="flex items-start justify-between gap-3 py-3 sm:py-4"
      >
        <h3 className="text-product line-clamp-2 flex-1 min-w-0 group-hover:opacity-70 transition-opacity duration-500 ease-primary">
          {title}
        </h3>
        <div className="shrink-0 text-right">
          <span className="text-product font-medium">
            {formatProductListPrice(product)}
          </span>
          {onSale && (
            <span className="block text-xs text-error line-through">
              {formatPrice(product.compareAtPrice!)}
            </span>
          )}
        </div>
      </Link>
      </ScrollReveal>

      {showMoqHint && <p className="sr-only">{t("product.moqFromFactory")}</p>}
    </article>
  );
}
