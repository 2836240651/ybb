/**
 * Recompute collections.json productCount / productHandles using rollup rules.
 * Usage: node scripts/refresh-collection-counts.mjs
 */

import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import {
  loadNavCollectionRollups,
  productHandlesForCollection,
} from "./lib/catalog-rollup.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const productsPath = join(root, "lib/data/products.json");
const collectionsPath = join(root, "lib/data/collections.json");
const navigationPath = join(root, "lib/data/navigation.json");

const products = JSON.parse(readFileSync(productsPath, "utf8"));
const collections = JSON.parse(readFileSync(collectionsPath, "utf8"));
let navRollups = {};
try {
  const nav = JSON.parse(readFileSync(navigationPath, "utf8"));
  navRollups = loadNavCollectionRollups(nav);
} catch {
  navRollups = {};
}

for (const col of collections) {
  const handles = productHandlesForCollection(col.handle, products, navRollups);
  col.productCount = handles.length;
  col.productHandles = handles;
}

writeFileSync(collectionsPath, JSON.stringify(collections, null, 2) + "\n", "utf8");
console.log(
  `Updated ${collections.length} collections; all=${productHandlesForCollection("all", products, navRollups).length}, other=${productHandlesForCollection("other", products, navRollups).length}`
);
