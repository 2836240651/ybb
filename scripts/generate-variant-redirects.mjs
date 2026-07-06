#!/usr/bin/env node
/**
 * Merge variant SKU redirects + Woo permalink legacy redirects into
 * lib/data/variant-redirects.json and deploy/htaccess.snippet.
 *
 * Usage: node scripts/generate-variant-redirects.mjs
 */
import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const variantRedirectsPath = join(root, "deploy/product-import/variant-redirects.json");
const productsPath = join(root, "lib/data/products.json");
const htaccessPath = join(root, "deploy/htaccess.snippet");
const libRedirectsPath = join(root, "lib/data/variant-redirects.json");

const variantRedirects = JSON.parse(readFileSync(variantRedirectsPath, "utf8"));
const products = JSON.parse(readFileSync(productsPath, "utf8"));

/** @type {Record<string, string>} */
const legacyRedirects = {};
for (const product of products) {
  const handle = String(product.handle || "").trim();
  const permalink = String(product.permalink || "");
  const match = permalink.match(/\/products\/([^/]+)\/?$/i);
  const legacySlug = match?.[1]?.trim();
  if (!handle || !legacySlug || legacySlug === handle) continue;
  if (legacyRedirects[legacySlug] && legacyRedirects[legacySlug] !== handle) {
    console.warn(
      `[generate-variant-redirects] legacy slug conflict: ${legacySlug} -> ${legacyRedirects[legacySlug]} vs ${handle}`
    );
    continue;
  }
  legacyRedirects[legacySlug] = handle;
}

/** variant SKU redirects win over legacy when keys collide */
const merged = { ...legacyRedirects, ...variantRedirects };

writeFileSync(libRedirectsPath, JSON.stringify(merged, null, 2) + "\n");

const variantMarkerStart = "# --- Variant SKU → parent PDP redirects (auto-generated) ---";
const variantMarkerEnd = "# --- End variant redirects ---";
const legacyMarkerStart = "# --- Woo permalink legacy → canonical handle (auto-generated) ---";
const legacyMarkerEnd = "# --- End legacy permalink redirects ---";

function rewriteBlock(htaccess, start, end, rules) {
  const block = `${start}\n${rules}\n${end}`;
  if (htaccess.includes(start)) {
    return htaccess.replace(new RegExp(`${start}[\\s\\S]*?${end}`), block);
  }
  return htaccess.replace("# Legacy product URLs", `${block}\n\n# Legacy product URLs`);
}

const variantRules = Object.entries(variantRedirects)
  .map(
    ([variantHandle, parentHandle]) =>
      `RewriteRule ^products/${variantHandle}/?$ /products/${parentHandle} [R=301,L]`
  )
  .join("\n");

const legacyRules = Object.entries(legacyRedirects)
  .map(
    ([legacySlug, handle]) =>
      `RewriteRule ^products/${legacySlug}/?$ /products/${handle} [R=301,L]`
  )
  .join("\n");

let htaccess = readFileSync(htaccessPath, "utf8");
htaccess = rewriteBlock(htaccess, variantMarkerStart, variantMarkerEnd, variantRules);
htaccess = rewriteBlock(htaccess, legacyMarkerStart, legacyMarkerEnd, legacyRules);
writeFileSync(htaccessPath, htaccess);

console.log(
  `[generate-variant-redirects] legacy=${Object.keys(legacyRedirects).length} variant=${Object.keys(variantRedirects).length} merged=${Object.keys(merged).length}`
);
