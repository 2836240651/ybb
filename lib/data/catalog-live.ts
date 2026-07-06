import { collections, getProductsByCollection, products } from "@/lib/data/products";

export type LiveCollectionLink = {
  handle: string;
  productCount: number;
};

/** Collections that still have at least one product in static catalog (post-sync). */
export function getLiveCollectionLinks(): LiveCollectionLink[] {
  const counts = new Map<string, number>();
  for (const product of products) {
    counts.set(product.collection, (counts.get(product.collection) ?? 0) + 1);
  }

  return collections
    .filter(
      (collection) =>
        collection.handle !== "all" &&
        collection.handle !== "new-arrivals" &&
        (counts.get(collection.handle) ?? 0) > 0
    )
    .map((collection) => ({
      handle: collection.handle,
      productCount: counts.get(collection.handle) ?? 0,
    }))
    .sort((a, b) => b.productCount - a.productCount);
}

export function getCollectionProductCount(handle: string): number {
  if (handle === "all") return products.length;
  return getProductsByCollection(handle).length;
}
