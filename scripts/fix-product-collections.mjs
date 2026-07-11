/**
 * One-off: fix misclassified collection fields in products.json.
 * Usage: node scripts/fix-product-collections.mjs
 */

import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { collectionFromSkuPrefix } from "./lib/catalog-rollup.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const productsPath = join(root, "lib/data/products.json");
const products = JSON.parse(readFileSync(productsPath, "utf8"));

const OVERRIDES = {
  "tz-zj-003": "rod-pod-accessories",
};

let changed = 0;
for (const product of products) {
  const override = OVERRIDES[product.handle];
  const next =
    override || collectionFromSkuPrefix(product.sku || product.handle) || product.collection;
  if (next !== product.collection) {
    console.log(`${product.handle}: ${product.collection} -> ${next}`);
    product.collection = next;
    changed += 1;
  }
}

writeFileSync(productsPath, JSON.stringify(products, null, 2) + "\n", "utf8");
console.log(`Patched ${changed} products.`);
