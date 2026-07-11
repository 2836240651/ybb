import type { Product } from "@/lib/types/product";

export type CollectionFilterParams = {
  sort?: string;
  availability?: string;
  price?: string;
  tag?: string;
};

export const SORT_OPTIONS = [
  { value: "featured", label: "Featured" },
  { value: "best-selling", label: "Best selling" },
  { value: "title-asc", label: "Alphabetically, A-Z" },
  { value: "title-desc", label: "Alphabetically, Z-A" },
  { value: "price-asc", label: "Price, low to high" },
  { value: "price-desc", label: "Price, high to low" },
  { value: "date-desc", label: "Date, new to old" },
] as const;

export const PRICE_RANGES = [
  { value: "", label: "All prices" },
  { value: "0-25", label: "Under £25" },
  { value: "25-50", label: "£25 - £50" },
  { value: "50+", label: "Over £50" },
] as const;

export const FILTER_TAGS = [
  { value: "", label: "All types" },
  { value: "new-arrival", label: "New arrivals" },
  { value: "wholesale", label: "Wholesale" },
  { value: "factory-direct", label: "Factory direct" },
  { value: "has-video", label: "Has video" },
] as const;

function matchesPrice(price: number, range: string): boolean {
  if (!range) return true;
  if (range === "0-25") return price < 25;
  if (range === "25-50") return price >= 25 && price <= 50;
  if (range === "50+") return price > 50;
  return true;
}

export function filterAndSortProducts(
  products: Product[],
  params: CollectionFilterParams
): Product[] {
  let result = [...products];

  if (params.availability === "in_stock") {
    result = result.filter((p) => p.available);
  } else if (params.availability === "out_of_stock") {
    result = result.filter((p) => !p.available);
  }

  if (params.price) {
    result = result.filter((p) => matchesPrice(p.price, params.price!));
  }

  if (params.tag) {
    result = result.filter((p) => p.tags.includes(params.tag!));
  }

  const sort = params.sort ?? "featured";
  switch (sort) {
    case "price-asc":
      result.sort((a, b) => a.price - b.price);
      break;
    case "price-desc":
      result.sort((a, b) => b.price - a.price);
      break;
    case "title-asc":
      result.sort((a, b) => a.title.localeCompare(b.title));
      break;
    case "title-desc":
      result.sort((a, b) => b.title.localeCompare(a.title));
      break;
    case "date-desc":
    case "best-selling":
      result.sort((a, b) => b.handle.localeCompare(a.handle));
      break;
    default:
      break;
  }

  return result;
}

export function countActiveFilters(params: CollectionFilterParams): number {
  let n = 0;
  if (params.availability) n++;
  if (params.price) n++;
  if (params.tag) n++;
  if (params.sort && params.sort !== "featured") n++;
  return n;
}
