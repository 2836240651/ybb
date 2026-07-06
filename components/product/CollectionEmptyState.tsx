"use client";

import { HardNavLink } from "@/lib/navigation/hard-nav-fallback";
import { getLiveCollectionLinks } from "@/lib/data/catalog-live";
import { getCollectionTitleByHandle } from "@/lib/i18n/content";
import { useI18n } from "@/lib/i18n/I18nProvider";

type CollectionEmptyStateProps = {
  currentHandle: string;
  reason: "empty" | "filtered" | "hidden";
};

export function CollectionEmptyState({
  currentHandle,
  reason,
}: CollectionEmptyStateProps) {
  const { t, locale } = useI18n();
  const liveCollections = getLiveCollectionLinks().filter(
    (entry) => entry.handle !== currentHandle
  );

  if (reason === "filtered") {
    return (
      <div className="py-12 text-center space-y-4">
        <p className="text-foreground/60">{t("collection.noProductsFound")}</p>
        <HardNavLink
          href="?"
          className="text-sm font-medium underline-offset-4 hover:underline"
        >
          {t("collection.clearFilters")}
        </HardNavLink>
      </div>
    );
  }

  const emptyCategory =
    reason === "empty" || reason === "hidden";

  return (
    <div
      className="py-12 text-center space-y-6 max-w-xl mx-auto"
      {...(emptyCategory ? { "data-collection-empty": "true" } : {})}
    >
      <div className="space-y-2">
        <p className="text-base font-medium text-foreground">
          {t("collection.emptyCategoryTitle")}
        </p>
        <p className="text-sm text-foreground/60">
          {reason === "hidden"
            ? t("collection.emptyCategoryHiddenHint")
            : t("collection.emptyCategoryHint")}
        </p>
      </div>

      {liveCollections.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-medium uppercase tracking-widest text-foreground/45">
            {t("collection.browseLiveCategories")}
          </p>
          <ul className="flex flex-wrap items-center justify-center gap-2" role="list">
            {liveCollections.map((entry) => (
              <li key={entry.handle}>
                <HardNavLink
                  href={`/collections/${entry.handle}`}
                  className="inline-flex items-center rounded-pill border border-border px-4 py-2 text-sm font-medium interaction-fill-button transition-colors"
                >
                  {getCollectionTitleByHandle(entry.handle, locale, t)}
                  <span className="ml-1.5 text-foreground/45">
                    ({entry.productCount})
                  </span>
                </HardNavLink>
              </li>
            ))}
          </ul>
        </div>
      )}

      <HardNavLink
        href="/collections/all"
        className="inline-flex text-sm font-medium underline-offset-4 hover:underline"
      >
        {t("collection.viewAllProducts")}
      </HardNavLink>
    </div>
  );
}
