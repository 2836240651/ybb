import productsData from "./products.json";
import collectionsData from "./collections.json";
import hotProductsData from "./hot-products.json";
import navigationData from "./navigation.json";
import { OTHER_CHILD_HANDLES } from "./catalog";
import type { Collection, Product, ProductVariant } from "@/lib/types/product";

export const products = productsData as Product[];
export const collections = collectionsData as Collection[];

export function getProductByHandle(handle: string): Product | undefined {
  return products.find((p) => p.handle === handle);
}

export function getCollectionByHandle(
  handle: string
): Collection | undefined {
  return collections.find((c) => c.handle === handle);
}

type NavMegaChild = { href?: string };
type NavMegaMenu = { children?: NavMegaChild[] };
type NavItem = { href?: string; megaMenu?: NavMegaMenu };
type NavigationJson = { primaryNav?: NavItem[] };

function parseCollectionHandleFromHref(href: string): string | null {
  const match = href.match(/^\/collections\/([^/?#]+)/);
  return match?.[1] ?? null;
}

function collectionHandlesFromNavMegaMenu(parentHandle: string): string[] {
  const targetHref = `/collections/${parentHandle}`;
  const navItems = (navigationData as unknown as NavigationJson)?.primaryNav;
  if (!Array.isArray(navItems)) return [];
  const parent = navItems.find((item) => item?.href === targetHref);
  const children = parent?.megaMenu?.children;
  if (!Array.isArray(children)) return [];

  const handles: string[] = [];
  for (const child of children) {
    const href = typeof child?.href === "string" ? child.href : "";
    const childHandle = parseCollectionHandleFromHref(href);
    if (childHandle) handles.push(childHandle);
  }
  return handles;
}

/** Parent nav entries with mega-menu children aggregate all child collection SKUs. */
function buildNavCollectionRollups(): Record<string, readonly string[]> {
  const navItems = (navigationData as unknown as NavigationJson)?.primaryNav;
  if (!Array.isArray(navItems)) return {};

  const rollups: Record<string, string[]> = {};
  for (const item of navItems) {
    const href = typeof item?.href === "string" ? item.href : "";
    const parentHandle = parseCollectionHandleFromHref(href);
    if (!parentHandle || !item?.megaMenu?.children?.length) continue;

    const childHandles = collectionHandlesFromNavMegaMenu(parentHandle);
    if (!childHandles.length) continue;

    rollups[parentHandle] = Array.from(
      new Set<string>([parentHandle, ...childHandles])
    );
  }
  return rollups;
}

const NAV_COLLECTION_ROLLUPS = buildNavCollectionRollups();

function getCollectionRollupHandles(handle: string): string[] {
  const fromNav = NAV_COLLECTION_ROLLUPS[handle] ?? collectionHandlesFromNavMegaMenu(handle);
  const merged = new Set<string>([handle, ...fromNav]);
  merged.delete("all");
  return Array.from(merged);
}

export function getProductsByCollection(handle: string): Product[] {
  if (handle === "all") {
    return products;
  }
  if (handle === "new-arrivals") {
    return products.filter((p) => p.tags.includes("new-arrival"));
  }
  if (handle === "other") {
    return products.filter((p) =>
      (OTHER_CHILD_HANDLES as readonly string[]).includes(p.collection)
    );
  }
  const rollup = getCollectionRollupHandles(handle);
  if (rollup.length > 1) {
    const allowed = new Set(rollup);
    return products.filter((p) => allowed.has(p.collection));
  }
  return products.filter((p) => p.collection === handle);
}

export function getNewArrivals(limit = 6): Product[] {
  return products.filter((p) => p.tags.includes("new-arrival")).slice(0, limit);
}

/** Homepage hot picks �?cross-category, order from hot-products.json */
export function getHotProducts(): Product[] {
  return hotProductsData.handles
    .map((handle) => getProductByHandle(handle))
    .filter((p): p is Product => Boolean(p));
}

export function isVariableProduct(product: Product): boolean {
  return (
    product.productType === "variable" ||
    (Array.isArray(product.variants) && product.variants.length > 1)
  );
}

export function getProductVariants(product: Product): ProductVariant[] {
  if (product.variants?.length) {
    return product.variants;
  }
  if (product.sku || product.spec) {
    return [
      {
        sku: product.sku || product.handle,
        spec: product.spec || "Default",
        price: product.price,
        compareAtPrice: product.compareAtPrice,
        available: product.available,
        wcId: product.wcId,
        images: product.images,
      },
    ];
  }
  return [];
}

export function getVariant(
  product: Product,
  specOrSku?: string
): ProductVariant | undefined {
  const variants = getProductVariants(product);
  if (!variants.length) return undefined;

  if (!specOrSku) {
    if (product.defaultVariantSku) {
      return (
        variants.find((v) => v.sku === product.defaultVariantSku) || variants[0]
      );
    }
    return variants[0];
  }

  return (
    variants.find((v) => v.spec === specOrSku || v.sku === specOrSku) ||
    variants[0]
  );
}

export function getDisplayPrice(product: Product): number {
  const variants = getProductVariants(product);
  if (!variants.length) return product.price;
  return Math.min(...variants.map((v) => v.price));
}

export function getVariantOptionLabels(product: Product): string[] {
  return getProductVariants(product).map((v) => v.spec);
}

export function formatPrice(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

export function formatProductListPrice(product: Product): string {
  if (isVariableProduct(product)) {
    return `From ${formatPrice(getDisplayPrice(product))}`;
  }
  return formatPrice(product.price);
}

export function getProductGalleryImages(
  product: Product,
  variant?: ProductVariant
): string[] {
  const selected = variant ?? getVariant(product);
  if (selected?.images?.length) {
    return selected.images;
  }
  return product.images?.length
    ? product.images
    : ["/images/placeholder-product.jpg"];
}

export function formatInstallmentPrice(amount: number, installments = 3): string {
  return formatPrice(amount / installments);
}

export function getSavePercent(price: number, compareAt: number): number {
  return Math.round(((compareAt - price) / compareAt) * 100);
}

/** OMC product-card overlay size pills when applicable */
export function getProductSizeOptions(product: Product): string[] | null {
  const variantSpecs = getVariantOptionLabels(product);
  if (variantSpecs.length > 1) return variantSpecs;
  if (product.tags.includes("apparel")) return ["S", "M", "L", "XL"];
  if (product.tags.includes("hooks") || product.collection === "hooks")
    return ["4", "6", "8", "10"];
  if (
    product.tags.includes("ready-rigs") ||
    product.collection === "ready-rigs"
  )
    return ["12lb", "15lb", "18lb"];
  return null;
}
