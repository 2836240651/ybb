#!/usr/bin/env node
/** Apply specEn/specZh/specJa to all variants in products.json (local, seconds). */

import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { enrichVariantSpecI18n } from "../lib/variant-spec-i18n.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const productsPath = join(root, "lib/data/products.json");

const products = JSON.parse(readFileSync(productsPath, "utf8"));
let updated = 0;

for (const product of products) {
  const variants = product.variants || [];
  if (!variants.length) continue;
  product.variants = variants.map((variant) => {
    const next = enrichVariantSpecI18n(variant);
    if (
      next.specEn !== variant.specEn ||
      next.specZh !== variant.specZh ||
      next.specJa !== variant.specJa
    ) {
      updated += 1;
    }
    return next;
  });
}

writeFileSync(productsPath, `${JSON.stringify(products, null, 2)}\n`, "utf8");
console.log(`[apply-variant-spec-i18n] products=${products.length} variantsUpdated=${updated}`);
