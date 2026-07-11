import collectionsData from "@/lib/data/collections.json";
import { catalogMainCategories, catalogOther } from "@/lib/data/catalog";
import { getCollectionProductCount } from "@/lib/data/catalog-live";
import type { YbbNavItem } from "@/lib/site-manager/navigation-api";

const WHOLESALE_ID = "wholesale";

/** Preferred wholesale mega menu order: 8 main tabs + Other rollup. */
const WHOLESALE_HANDLE_ORDER = [
  ...catalogMainCategories.map((category) => category.handle),
  catalogOther.handle,
];

export function buildWholesaleNavItem(): YbbNavItem {
  const collectionByHandle = new Map(
    collectionsData.map((collection) => [collection.handle, collection])
  );

  const children = WHOLESALE_HANDLE_ORDER.filter(
    (handle) => getCollectionProductCount(handle) > 0
  )
    .map((handle) => {
      const collection = collectionByHandle.get(handle);
      if (!collection) return null;
      return {
        label: collection.title,
        labels: {
          en: collection.title,
          zh: collection.titleCn,
          ja: collection.title,
        },
        href: `/collections/${collection.handle}`,
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));

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
          ja: "すべての商品を見る",
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
