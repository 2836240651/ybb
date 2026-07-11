import {
  catalogMainCategories,
  catalogOther,
  OTHER_CHILD_HANDLES,
} from "@/lib/data/catalog";
import { collections, getProductsByCollection, products } from "@/lib/data/products";

export type LiveCollectionLink = {
  handle: string;
  productCount: number;
};

/** Nav-level handles only — exclude mega-menu children already rolled into a parent. */
const NAV_LEVEL_COLLECTION_HANDLES = [
  ...catalogMainCategories.map((category) => category.handle),
  catalogOther.handle,
];

const ROLLED_UP_CHILD_HANDLES = new Set<string>([
  "sinker-rigs",
  "bait-cage-rigs",
  ...OTHER_CHILD_HANDLES,
]);

/** Collections that still have at least one product in static catalog (post-sync). */
export function getLiveCollectionLinks(): LiveCollectionLink[] {
  const allowed = new Set(NAV_LEVEL_COLLECTION_HANDLES);
  return collections
    .filter(
      (collection) =>
        allowed.has(collection.handle) &&
        !ROLLED_UP_CHILD_HANDLES.has(collection.handle)
    )
    .map((collection) => ({
      handle: collection.handle,
      productCount: getProductsByCollection(collection.handle).length,
    }))
    .filter((entry) => entry.productCount > 0)
    .sort((a, b) => b.productCount - a.productCount);
}

export function getCollectionProductCount(handle: string): number {
  if (handle === "all") return products.length;
  return getProductsByCollection(handle).length;
}
