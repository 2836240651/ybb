import collectionsData from "@/lib/data/collections.json";
import type { YbbNavItem } from "@/lib/site-manager/navigation-api";

const WHOLESALE_ID = "wholesale";

/** Collection handles excluded from the wholesale mega menu grid. */
const EXCLUDED_HANDLES = new Set(["all"]);

export function buildWholesaleNavItem(): YbbNavItem {
  const children = collectionsData
    .filter((collection) => !EXCLUDED_HANDLES.has(collection.handle))
    .map((collection) => ({
      label: collection.title,
      labels: {
        en: collection.title,
        zh: collection.titleCn,
        ja: collection.title,
      },
      href: `/collections/${collection.handle}`,
    }));

  return {
    id: WHOLESALE_ID,
    label: "Wholesale",
    labels: {
      en: "Wholesale",
      zh: "批发",
      ja: "卸売",
    },
    href: "/collections/all",
    megaMenu: {
      variant: "wholesale",
      children,
      shopAll: {
        label: "Shop All Products",
        labels: {
          en: "Shop All Products",
          zh: "查看全部产品",
          ja: "すべての商品を見�?,
        },
        href: "/collections/all",
      },
    },
  };
}

/** Prepend Wholesale catalog mega menu before 2026 New Products (and dedupe). */
export function withWholesaleNav(nav: YbbNavItem[]): YbbNavItem[] {
  const rest = nav.filter(
    (item) => item.id !== WHOLESALE_ID && item.label !== "Wholesale"
  );
  return [buildWholesaleNavItem(), ...rest];
}
