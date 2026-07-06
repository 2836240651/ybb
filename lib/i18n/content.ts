import { getCollectionByHandle } from "@/lib/data/products";
import type { Collection, Product } from "@/lib/types/product";
import type { Locale } from "./locales";

export function getLocalizedProductTitle(
  product: Product,
  locale: Locale
): string {
  if (locale === "zh") return product.titleCn || product.title;
  return product.title;
}

export function getLocalizedCollectionTitle(
  collection: Collection,
  locale: Locale,
  t: (key: string) => string
): string {
  if (locale === "zh") return collection.titleCn || collection.title;
  if (locale === "ja") {
    const key = `collections.${collection.handle}`;
    const translated = t(key);
    return translated !== key ? translated : collection.title;
  }
  return collection.title;
}

export function getCollectionTitleByHandle(
  handle: string,
  locale: Locale,
  t: (key: string) => string,
  fallback?: string
): string {
  const collection = getCollectionByHandle(handle);
  if (collection) return getLocalizedCollectionTitle(collection, locale, t);
  return fallback ?? handle.replace(/-/g, " ");
}
