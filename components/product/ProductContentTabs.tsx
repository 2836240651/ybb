"use client";

import { useEffect, useMemo, useState } from "react";
import { ProductReviewsTabPanel } from "@/components/product/ProductReviewsTabPanel";
import { formatReviewCountDisplay } from "@/lib/product-reviews";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { ProductContentPayload } from "@/lib/site-manager/product-overrides-api";
import type { ResolvedProductContent } from "@/lib/site-manager/product-content";
import { pickProductContentForLocale } from "@/lib/site-manager/product-content";
import { fetchLiveReviewCount } from "@/lib/woocommerce/product-reviews-api";
import type { Product } from "@/lib/types/product";
import { cn } from "@/lib/utils";

type TabId = "description" | "additional" | "reviews";

type ProductContentTabsProps = {
  content?: ProductContentPayload | null;
  ready: boolean;
  product: Product;
};

function ProductContentTabsSkeleton() {
  return (
    <section
      className="mt-10 md:mt-12 border-t border-border pt-8"
      aria-busy="true"
      aria-label="Product details loading"
    >
      <div className="h-5 w-40 rounded bg-neutral-100 animate-pulse mb-6" />
      <div className="space-y-3">
        <div className="h-3 w-full max-w-3xl rounded bg-neutral-100 animate-pulse" />
        <div className="h-3 w-full max-w-2xl rounded bg-neutral-100 animate-pulse" />
        <div className="h-3 w-5/6 max-w-xl rounded bg-neutral-100 animate-pulse" />
      </div>
    </section>
  );
}

function renderTabPanel(
  tabId: TabId,
  resolved: ResolvedProductContent,
  product: Product
) {
  if (tabId === "description") {
    return <DescriptionPanel html={resolved.descriptionHtml} />;
  }
  if (tabId === "additional") {
    return <AdditionalInfoTable rows={resolved.rows} />;
  }
  return <ProductReviewsTabPanel product={product} />;
}

export function ProductContentTabs({ content, ready, product }: ProductContentTabsProps) {
  const { t, locale } = useI18n();
  const resolved = useMemo(
    () => (content ? pickProductContentForLocale(content, locale) : null),
    [content, locale]
  );

  const [liveReviewCount, setLiveReviewCount] = useState(product.reviewCount ?? 0);

  useEffect(() => {
    if (!product.wcId) return;
    let cancelled = false;
    fetchLiveReviewCount(product.wcId)
      .then((count) => {
        if (!cancelled) setLiveReviewCount(count);
      })
      .catch(() => {
        // Keep fallback from products.json.
      });
    return () => {
      cancelled = true;
    };
  }, [product.wcId, product.reviewCount]);

  const tabs = useMemo(() => {
    const items: Array<{ id: TabId; label: string }> = [];
    if (resolved?.descriptionVisible) {
      items.push({ id: "description", label: t("product.tabDescription") });
    }
    if (resolved?.additionalVisible) {
      items.push({
        id: "additional",
        label: t("product.tabAdditionalInfo"),
      });
    }
    if (product.wcId) {
      items.push({
        id: "reviews",
        label: t("product.tabReviews", {
          count: formatReviewCountDisplay(liveReviewCount),
        }),
      });
    }
    return items;
  }, [resolved, t, product.wcId, liveReviewCount]);

  const [active, setActive] = useState<TabId>("description");

  useEffect(() => {
    if (tabs.length === 0) return;
    if (!tabs.some((tab) => tab.id === active)) {
      setActive(tabs[0].id);
    }
  }, [tabs, active]);

  if (!ready) {
    return <ProductContentTabsSkeleton />;
  }
  if (tabs.length === 0) {
    return null;
  }

  const activeTab = tabs.find((tab) => tab.id === active) ?? tabs[0];
  const panelResolved: ResolvedProductContent = resolved ?? {
    descriptionHtml: "",
    rows: [],
    descriptionVisible: false,
    additionalVisible: false,
  };

  return (
    <section
      id="product-reviews-tab"
      className="mt-10 md:mt-12 border-t border-border pt-8"
      aria-label={t("product.contentTabsLabel")}
    >
      <div className="hidden md:flex gap-8 border-b border-border mb-6">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActive(tab.id)}
            className={cn(
              "pb-3 text-sm transition-colors",
              activeTab.id === tab.id
                ? "font-medium text-foreground border-b-2 border-foreground -mb-px"
                : "text-foreground/55 hover:text-foreground"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="md:hidden space-y-2">
        {tabs.map((tab) => {
          const open = activeTab.id === tab.id;
          return (
            <div key={tab.id} className="border border-border rounded-input overflow-hidden">
              <button
                type="button"
                onClick={() => setActive(tab.id)}
                className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium"
                aria-expanded={open}
              >
                {tab.label}
                <span aria-hidden className="text-foreground/50">
                  {open ? "�? : "+"}
                </span>
              </button>
              {open ? (
                <div className="border-t border-border px-4 py-4">
                  {renderTabPanel(tab.id, panelResolved, product)}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="hidden md:block">
        {renderTabPanel(activeTab.id, panelResolved, product)}
      </div>
    </section>
  );
}

function DescriptionPanel({ html }: { html: string }) {
  return (
    <div
      className="max-w-none text-foreground/80 leading-relaxed [&_p]:mb-4 [&_p:last-child]:mb-0 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-4 [&_ul]:space-y-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:mb-4 [&_li]:mb-1 [&_h2]:mt-6 [&_h2]:mb-3 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-foreground [&_hr]:my-6 [&_hr]:border-border"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

function AdditionalInfoTable({
  rows,
}: {
  rows: ProductContentPayload["additionalInfo"]["rows"];
}) {
  return (
    <table className="w-full text-sm border-collapse">
      <tbody>
        {rows.map((row) => (
          <tr key={row.key} className="border-b border-border last:border-b-0">
            <th
              scope="row"
              className="py-3 pr-6 text-left font-medium text-foreground align-top w-40 sm:w-48"
            >
              {row.label}
            </th>
            <td className="py-3 text-foreground/75 align-top">
              {row.href ? (
                <a href={row.href} className="hover:opacity-70 underline-offset-2 hover:underline">
                  {row.value}
                </a>
              ) : (
                row.value
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
