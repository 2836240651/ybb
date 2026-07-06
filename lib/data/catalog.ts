import taxonomy from "./catalog-taxonomy.json";

export type CatalogCategory = {
  sheetName: string;
  handle: string;
  titleCn: string;
  titleEn: string;
  productTypeCount: number;
  productTypes: string[];
};

export const OTHER_CHILD_HANDLES = [
  "accessories-metal",
  "accessories-plastic",
  "rod-pod-accessories",
  "peripheral-equipment",
] as const;

export type OtherChildHandle = (typeof OTHER_CHILD_HANDLES)[number];

export const catalogMainCategories = taxonomy.mainCategories as CatalogCategory[];
export const catalogOther = taxonomy.other as {
  handle: string;
  titleCn: string;
  titleEn: string;
  productTypeCount: number;
  children: CatalogCategory[];
};

export const catalogNavHandles = taxonomy.navOrder.filter(
  (handle) => handle !== "oem-odm"
);

/** Homepage wholesale collections carousel �?8 main + 4 Other children */
export const wholesaleCarouselHandles = [
  ...catalogMainCategories.map((c) => c.handle),
  ...catalogOther.children.map((c) => c.handle),
] as const;

export type WholesaleCarouselHandle = (typeof wholesaleCarouselHandles)[number];

export type CategoryBarItem = {
  handle: string;
  titleEn: string;
  titleCn: string;
};

export function getCategoryBarItems(): CategoryBarItem[] {
  return [
    ...catalogMainCategories.map((category) => ({
      handle: category.handle,
      titleEn: category.titleEn,
      titleCn: category.titleCn,
    })),
    {
      handle: catalogOther.handle,
      titleEn: catalogOther.titleEn,
      titleCn: catalogOther.titleCn,
    },
  ];
}

export function isOtherChildHandle(handle: string): handle is OtherChildHandle {
  return (OTHER_CHILD_HANDLES as readonly string[]).includes(handle);
}

/** Map collection handle to the top-level category tab highlight. */
export function resolveCategoryNavActive(handle: string): string {
  if (handle === "other" || isOtherChildHandle(handle)) {
    return "other";
  }
  if (catalogMainCategories.some((category) => category.handle === handle)) {
    return handle;
  }
  return handle;
}

export function getOtherChildCategories(): CatalogCategory[] {
  return catalogOther.children;
}
