"use client";

import {
  SORT_OPTIONS,
} from "@/lib/collection-filters";
import { useUI } from "@/lib/store/ui";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { cn } from "@/lib/utils";
import { useCollectionQuery } from "./CollectionQueryProvider";

export function CollectionToolbar({ productCount }: { productCount: number }) {
  const { t } = useI18n();
  const { openFilter } = useUI();
  const { sort, activeFilterCount, updateSort } = useCollectionQuery();

  return (
    <div className="mb-8 flex flex-col gap-4 border-b border-border py-6 sm:flex-row sm:items-center sm:justify-between">
      <button
        type="button"
        onClick={openFilter}
        className={cn(
          "touch-target inline-flex w-full sm:w-auto items-center justify-center gap-2",
          "rounded-input border border-border px-5 py-2.5 text-sm font-medium",
          "hover:bg-neutral-50 transition-colors duration-500 ease-primary"
        )}
        aria-label={t("collection.showFilters")}
      >
        {t("collection.showFilters")}
        {activeFilterCount > 0 && (
          <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-foreground text-background text-xs px-1">
            {activeFilterCount}
          </span>
        )}
      </button>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
        <p className="text-sm text-foreground/50 sm:order-first sm:mr-auto">
          {productCount} {t("common.products")}
        </p>
        <label className="sr-only" htmlFor="collection-sort">
          {t("collection.sortProducts")}
        </label>
        <select
          id="collection-sort"
          value={sort}
          onChange={(e) => updateSort(e.target.value)}
          className={cn(
            "touch-target w-full sm:w-auto min-w-[200px] rounded-input border border-border bg-white px-4 py-2.5 text-sm",
            "focus:outline-none focus:ring-2 focus:ring-foreground/20"
          )}
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {t(`collection.sort.${opt.value}`)}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
