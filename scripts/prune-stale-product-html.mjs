#!/usr/bin/env node
/**
 * Remove stale product HTML files whose slug is not a current catalog handle.
 * Run after `npm run build` and before zipping out/.
 */
import { readdirSync, readFileSync, unlinkSync, statSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const productsPath = join(root, "lib/data/products.json");
const outProductsDir = join(root, "out/products");

const products = JSON.parse(readFileSync(productsPath, "utf8"));
const validHandles = new Set(products.map((p) => String(p.handle || "").trim()).filter(Boolean));

let removed = 0;
let kept = 0;

if (!statSync(outProductsDir).isDirectory()) {
  console.error("[prune-stale-product-html] missing out/products");
  process.exit(1);
}

for (const name of readdirSync(outProductsDir)) {
  if (!name.endsWith(".html")) continue;
  const slug = name.replace(/\.html$/i, "");
  if (slug === "reviews" || slug.startsWith("reviews/")) {
    kept++;
    continue;
  }
  if (validHandles.has(slug)) {
    kept++;
    continue;
  }
  unlinkSync(join(outProductsDir, name));
  removed++;
  console.log(`[prune-stale-product-html] removed ${name}`);
}

console.log(`[prune-stale-product-html] kept=${kept} removed=${removed}`);
