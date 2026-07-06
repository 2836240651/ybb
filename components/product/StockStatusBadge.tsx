"use client";

import { useI18n } from "@/lib/i18n/I18nProvider";
import { cn } from "@/lib/utils";

type StockStatusBadgeProps = {
  available: boolean;
};

export function StockStatusBadge({ available }: StockStatusBadgeProps) {
  const { t } = useI18n();

  if (!available) {
    return (
      <span className="inline-flex items-center gap-2 rounded-pill border border-border px-3 py-1.5 text-xs font-medium text-foreground/70">
        {t("product.outOfStock")}
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-pill px-3 py-1.5 text-xs font-medium",
        "bg-[rgb(var(--color-success-text)/0.08)] text-[rgb(var(--color-success-text))]"
      )}
    >
      <span
        className="h-2 w-2 rounded-full bg-[rgb(var(--color-success-text))]"
        aria-hidden
      />
      {t("product.inStock")}
    </span>
  );
}
