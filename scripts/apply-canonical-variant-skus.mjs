#!/usr/bin/env node
/** Force canonical variant SKUs from variation-sku-patch.json into products.json */

import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { canonicalVariantSku } from "../lib/sku-normalize.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const productsPath = join(root, "lib/data/products.json");
const patchPath = join(root, "deploy/variation-sku-patch.json");

const products = JSON.parse(readFileSync(productsPath, "utf8"));
const patch = JSON.parse(readFileSync(patchPath, "utf8"));
const handles = new Set(
  (patch.patches || []).map((p) => String(p.handle || "").toLowerCase())
);
const targetByWcId = new Map(
  (patch.patches || []).map((p) => [Number(p.variationWcId), String(p.targetSku || "")])
);

let updated = 0;
for (const product of products) {
  const handle = String(product.handle || "").toLowerCase();
  if (!handles.has(handle)) continue;
  const parentSku = String(product.sku || "");
  for (const variant of product.variants || []) {
    const wcId = Number(variant.wcId || 0);
    const spec = String(variant.spec || "");
    const target =
      targetByWcId.get(wcId) || canonicalVariantSku(parentSku, spec);
    if (variant.sku !== target) {
      variant.sku = target;
      updated++;
    }
  }
  const first = product.variants?.[0];
  if (first?.sku) {
    product.defaultVariantSku = first.sku;
    product.spec = first.spec || product.spec;
  }
}

writeFileSync(productsPath, `${JSON.stringify(products, null, 2)}\n`, "utf8");
console.log(
  `[apply-canonical-variant-skus] handles=${handles.size} variantSkuUpdates=${updated}`
);
