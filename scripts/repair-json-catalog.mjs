import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function repairBrokenJsonStrings(rel) {
  const file = path.join(root, rel);
  let text = fs.readFileSync(file, "utf8");
  text = text
    .replace(/\uFFFD/g, "")
    .replace(/â€\?/g, "-")
    .replace(/â€"/g, "-")
    .replace(/Â£/g, "£");
  const lines = text.split(/\r?\n/);
  const fixed = lines.map((line) => {
    if (/^\s*"[^"]*\?,?\s*$/.test(line) && !line.trim().endsWith('",')) {
      return line.replace(/\?,?\s*$/, "）\",");
    }
    if (/^\s*"[^"]*\?\s*,\s*$/.test(line)) {
      return line.replace(/\?\s*,/, "）\",");
    }
    return line;
  });
  const out = fixed.join("\n") + "\n";
  JSON.parse(out);
  fs.writeFileSync(file, out, "utf8");
  console.log("repaired json", rel);
}

for (const rel of ["lib/data/catalog-taxonomy.json", "lib/data/wc-category-sync.json"]) {
  try {
    repairBrokenJsonStrings(rel);
  } catch (e) {
    console.error("failed", rel, e.message);
  }
}

fs.writeFileSync(
  path.join(root, "lib/collection-filters.ts"),
  `import type { Product } from "@/lib/types/product";

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
`,
  "utf8"
);

fs.writeFileSync(
  path.join(root, "components/icons/IconEye.tsx"),
  `type IconEyeProps = {
  className?: string;
};

/** OMC icon-eye viewBox 0 0 16 16 */
export function IconEye({ className }: IconEyeProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 16 16"
      stroke="currentColor"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1}
        d="M14.6666 7.99999C14.6666 9.66666 12.6666 13.3333 7.99992 13.3333C3.33325 13.3333 1.33325 9.66666 1.33325 7.99999C1.33325 6.33332 3.33325 2.66666 7.99992 2.66666C12.6666 2.66666 14.6666 6.33332 14.6666 7.99999Z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1}
        d="M7.99992 10C9.10449 10 9.99992 9.10457 9.99992 8C9.99992 6.89543 9.10449 6 7.99992 6C6.89535 6 5.99992 6.89543 5.99992 8C5.99992 9.10457 6.89535 10 7.99992 10Z"
      />
    </svg>
  );
}
`,
  "utf8"
);

console.log("rewrote collection-filters.ts and IconEye.tsx");
