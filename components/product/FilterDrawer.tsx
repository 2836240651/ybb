"use client";

import { useEffect } from "react";
import {
  FILTER_TAGS,
  PRICE_RANGES,
} from "@/lib/collection-filters";
import { useUI } from "@/lib/store/ui";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { cn } from "@/lib/utils";
import { useCollectionQuery } from "./CollectionQueryProvider";

const PRICE_RANGE_KEYS: Record<string, string> = {
  "": "all",
  "0-25": "under-25",
  "25-50": "25-50",
  "50+": "over-50",
};

function FilterSection({
  title,
  children,
  defaultOpen = true,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details
      open={defaultOpen}
      className="group border-b border-border py-4"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium [&::-webkit-details-marker]:hidden">
        {title}
        <span className="text-foreground/40 transition-transform group-open:rotate-180">
          {"\u25BE"}
        </span>
      </summary>
      <div className="mt-3 space-y-2">{children}</div>
    </details>
  );
}

function RadioRow({
  name,
  value,
  checked,
  label,
  onChange,
}: {
  name: string;
  value: string;
  checked: boolean;
  label: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-3 text-sm text-foreground/80 hover:text-foreground">
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={() => onChange(value)}
        className="h-4 w-4 accent-foreground"
      />
      {label}
    </label>
  );
}

export function FilterDrawer() {
  const { filterOpen, closeFilter } = useUI();
  const { t } = useI18n();
  const { filters, activeFilterCount, setParam, clearFilters } =
    useCollectionQuery();

  useEffect(() => {
    document.body.style.overflow = filterOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [filterOpen]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeFilter();
    };
    if (filterOpen) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [filterOpen, closeFilter]);

  return (
    <>
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/40 transition-opacity duration-300",
          filterOpen
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none"
        )}
        aria-hidden={!filterOpen}
        onClick={closeFilter}
      />
      <aside
        role="dialog"
        aria-modal={filterOpen}
        aria-label={t("collection.filterProducts")}
        aria-hidden={!filterOpen}
        inert={filterOpen ? undefined : true}
        className={cn(
          "fixed top-0 left-0 z-50 flex h-full w-full max-w-[360px] flex-col bg-white shadow-2xl",
          "transition-transform duration-500 ease-nav",
          filterOpen
            ? "translate-x-0 pointer-events-auto"
            : "-translate-x-full pointer-events-none"
        )}
      >
        <header className="flex items-center justify-between border-b border-border px-6 py-5">
          <h2 className="text-lg font-bold tracking-tight">
            {t("collection.filterTitle")}
            {activeFilterCount > 0 && (
              <span className="ml-2 text-sm font-normal text-foreground/50">
                ({activeFilterCount})
              </span>
            )}
          </h2>
          <button
            type="button"
            onClick={closeFilter}
            className="rounded-full p-2 interaction-icon-hover transition-colors"
            aria-label={t("collection.closeFilters")}
          >
            {"\u00D7"}
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-6">
          <FilterSection title={t("collection.availability")}>
            <RadioRow
              name="availability"
              value=""
              checked={!filters.availability || filters.availability === "all"}
              label={t("collection.all")}
              onChange={() => setParam("availability", "")}
            />
            <RadioRow
              name="availability"
              value="in_stock"
              checked={filters.availability === "in_stock"}
              label={t("collection.inStock")}
              onChange={() => setParam("availability", "in_stock")}
            />
            <RadioRow
              name="availability"
              value="out_of_stock"
              checked={filters.availability === "out_of_stock"}
              label={t("collection.outOfStock")}
              onChange={() => setParam("availability", "out_of_stock")}
            />
          </FilterSection>

          <FilterSection title={t("collection.price")}>
            {PRICE_RANGES.map((range) => (
              <RadioRow
                key={range.value || "all"}
                name="price"
                value={range.value}
                checked={(filters.price ?? "") === range.value}
                label={t(
                  `collection.priceRange.${PRICE_RANGE_KEYS[range.value] ?? "all"}`
                )}
                onChange={() => setParam("price", range.value)}
              />
            ))}
          </FilterSection>

          <FilterSection title={t("collection.productType")}>
            {FILTER_TAGS.map((tag) => (
              <RadioRow
                key={tag.value || "all"}
                name="tag"
                value={tag.value}
                checked={(filters.tag ?? "") === tag.value}
                label={t(
                  `collection.filterTags.${tag.value || "all"}`
                )}
                onChange={() => setParam("tag", tag.value)}
              />
            ))}
          </FilterSection>
        </div>

        <footer className="border-t border-border px-6 py-4 flex gap-3">
          <button
            type="button"
            onClick={clearFilters}
            className="flex-1 rounded-pill border border-border py-3 text-sm font-medium interaction-fill-button transition-colors"
          >
            {t("collection.clearAll")}
          </button>
          <button
            type="button"
            onClick={closeFilter}
            className="flex-1 rounded-pill bg-foreground text-background py-3 text-sm font-medium hover:bg-neutral-800 transition-colors duration-500 ease-primary"
          >
            {t("collection.apply")}
          </button>
        </footer>
      </aside>
    </>
  );
}
