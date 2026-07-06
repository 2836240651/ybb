"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { catalogMainCategories } from "@/lib/data/catalog";
import { getProductsByCollection } from "@/lib/data/products";
import { useCollectionTitle, useI18n } from "@/lib/i18n/I18nProvider";
import { cn } from "@/lib/utils";
import { HorizontalProductCarousel } from "./HorizontalProductCarousel";
import { ScrollReveal } from "@/components/motion/ScrollReveal";

const TABS = catalogMainCategories.slice(0, 6).map((category) => ({
  id: category.handle,
  fallback: category.titleEn,
}));

function TabLabel({ id, fallback }: { id: string; fallback: string }) {
  return <>{useCollectionTitle(id, fallback)}</>;
}

export function TabbedCollectionCarousel() {
  const { t } = useI18n();
  const [active, setActive] = useState(TABS[0]?.id ?? "2026-new-products");
  const [panelVisible, setPanelVisible] = useState(true);

  const products = useMemo(
    () => getProductsByCollection(active).slice(0, 6),
    [active]
  );

  const activeTab = TABS.find((tab) => tab.id === active) ?? TABS[0]!;
  const activeTabLabel = useCollectionTitle(active, activeTab.fallback);

  const handleTabChange = (id: string) => {
    if (id === active) return;
    setPanelVisible(false);
    window.setTimeout(() => {
      setActive(id);
      setPanelVisible(true);
    }, 150);
  };

  return (
    <section
      className="page-container"
      aria-labelledby="collections-heading"
    >
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
        <ScrollReveal animate="fade-up-large">
          <h2 id="collections-heading" className="text-title-md">
            {t("home.collections")}
          </h2>
        </ScrollReveal>
        <Link
          href="/collections"
          className="text-sm font-medium underline-offset-4 hover:underline shrink-0"
        >
          {t("common.viewAll")}
        </Link>
      </div>

      <div
        role="tablist"
        aria-label={t("home.wholesaleCollectionsTablist")}
        className="category-nav-bar category-nav-bar--compact mb-8"
      >
        <ul className="category-nav-bar__list">
          {TABS.map((tab) => {
            const isActive = active === tab.id;
            return (
              <li key={tab.id} className="category-nav-bar__item">
                <button
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  aria-controls={`panel-${tab.id}`}
                  id={`tab-${tab.id}`}
                  onClick={() => handleTabChange(tab.id)}
                  className={cn(
                    "category-nav-bar__link",
                    isActive && "category-nav-bar__link--active"
                  )}
                >
                  <TabLabel id={tab.id} fallback={tab.fallback} />
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <div
        role="tabpanel"
        id={`panel-${active}`}
        aria-labelledby={`tab-${active}`}
        className={cn(
          "relative transition-[opacity,transform] duration-300 ease-primary",
          panelVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
        )}
      >
        <HorizontalProductCarousel
          key={active}
          products={products}
          ariaLabel={`${activeTabLabel} products`}
        />
        <p className="mt-6 text-sm">
          <Link
            href={`/collections/${active}`}
            className="underline-offset-4 hover:underline"
          >
            {t("common.viewAllProductsIn", { collection: activeTabLabel })}
          </Link>
        </p>
      </div>
    </section>
  );
}
