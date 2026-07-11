"use client";

import { useState } from "react";
import type { Product } from "@/lib/types/product";
import { useCart } from "@/lib/store/cart";
import { cn } from "@/lib/utils";
import { formatPrice } from "@/lib/data/products";
import { useI18n } from "@/lib/i18n/I18nProvider";

type AddToCartButtonProps = {
  product: Product;
  variant?: string;
  quantity?: number;
  className?: string;
  label?: string;
  showPriceInLabel?: boolean;
  compact?: boolean;
  size?: "sm" | "md" | "lg";
  fullWidth?: boolean;
};

export function AddToCartButton({
  product,
  variant = "Default",
  quantity = 1,
  className,
  label = "Add to cart",
  showPriceInLabel = false,
  compact = false,
  size,
  fullWidth,
}: AddToCartButtonProps) {
  const { t } = useI18n();
  const addItem = useCart((s) => s.addItem);
  const [added, setAdded] = useState(false);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!product.available) return;
    addItem(product, variant, quantity);
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1500);
  };

  const resolvedSize = size ?? (compact ? "sm" : "md");

  const cartLabel =
    showPriceInLabel && product.available
      ? `${label}${" \u2014 "}${formatPrice(product.price)}`
      : label;

  return (
    <button
      type="button"
      name="add"
      onClick={handleClick}
      disabled={!product.available}
      className={cn(
        "inline-flex items-center justify-center rounded-button font-medium interaction-cta",
        "bg-foreground text-background",
        "hover:bg-neutral-800 active:scale-[0.98]",
        "motion-reduce:active:scale-100",
        "disabled:cursor-not-allowed disabled:opacity-40",
        resolvedSize === "sm" && "px-4 py-2 text-button",
        resolvedSize === "md" && "px-6 py-3 text-button",
        resolvedSize === "lg" && "px-8 h-[52px] lg:h-[60px] text-sm lg:text-button",
        fullWidth && "w-full",
        className
      )}
    >
      {!product.available
        ? t("product.outOfStock")
        : added
          ? t("product.added")
          : cartLabel}
    </button>
  );
}
