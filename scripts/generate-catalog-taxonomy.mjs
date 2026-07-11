#!/usr/bin/env node
/** Generate minimal valid catalog-taxonomy.json from collections.json */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const collections = JSON.parse(
  fs.readFileSync(path.join(root, "lib/data/collections.json"), "utf8")
);

const navOrder = [
  "2026-new-products",
  "sinkers",
  "bait-cages",
  "rigs",
  "sinker-rigs",
  "bait-cage-rigs",
  "carp-hooks",
  "euro-carp-kits",
  "other",
  "oem-odm",
];

const otherChildren = [
  "accessories-metal",
  "accessories-plastic",
  "rod-pod-accessories",
  "peripheral-equipment",
];

const byHandle = Object.fromEntries(collections.map((c) => [c.handle, c]));

function cat(handle) {
  const c = byHandle[handle] || {};
  return {
    sheetName: c.titleCn || c.title || handle,
    handle,
    titleCn: c.titleCn || c.title || handle,
    titleEn: c.title || handle,
    productTypeCount: c.productCount || 0,
    productTypes: [],
  };
}

const mainCategories = navOrder
  .filter((h) => h !== "other" && h !== "oem-odm")
  .map(cat);

const other = {
  handle: "other",
  titleCn: byHandle.other?.titleCn || "其他",
  titleEn: byHandle.other?.title || "Other",
  productTypeCount: otherChildren.reduce(
    (n, h) => n + (byHandle[h]?.productCount || 0),
    0
  ),
  children: otherChildren.map(cat),
};

const taxonomy = {
  source: "generated-from-collections.json",
  mainCategories,
  other,
  navOrder,
};

fs.writeFileSync(
  path.join(root, "lib/data/catalog-taxonomy.json"),
  JSON.stringify(taxonomy, null, 2) + "\n",
  "utf8"
);

// minimal wc-category-sync stub if broken
const wcSyncPath = path.join(root, "lib/data/wc-category-sync.json");
try {
  JSON.parse(fs.readFileSync(wcSyncPath, "utf8"));
} catch {
  fs.writeFileSync(
    wcSyncPath,
    JSON.stringify({ categories: [], generatedAt: new Date().toISOString() }, null, 2) + "\n",
    "utf8"
  );
  console.log("stubbed wc-category-sync.json");
}

console.log("wrote catalog-taxonomy.json", mainCategories.length, "main categories");
