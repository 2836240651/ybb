#!/usr/bin/env node
/** Rewrite product image URLs in out HTML to same-origin /products/{handle}/master.webp */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "out");
const products = JSON.parse(fs.readFileSync(path.join(ROOT, "lib/data/products.json"), "utf8"));

const localBySku = Object.fromEntries(
  products.filter((p) => p.sku).map((p) => [p.sku, `/products/${p.handle}/master.webp`])
);

function walk(dir, acc = []) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    if (fs.statSync(p).isDirectory()) walk(p, acc);
    else if (name.endsWith(".html")) acc.push(p);
  }
  return acc;
}

let files = 0;
for (const file of walk(OUT)) {
  let text = fs.readFileSync(file, "utf8");
  const before = text;

  // Fix prior bad rewrite (master.webp.jpeg / master.webp.png)
  text = text.replace(/\/products\/([a-z0-9-]+)\/master\.webp\.(?:jpe?g|png)/gi, "/products/$1/master.webp");

  for (const [sku, local] of Object.entries(localBySku)) {
    const esc = sku.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
    const re = new RegExp(
      `https://carp-ybb\\.com/wp-content/uploads/2026/\\d+/${esc}\\.(?:jpe?g|png)`,
      "gi"
    );
    text = text.replace(re, local);
  }

  if (text !== before) {
    fs.writeFileSync(file, text, "utf8");
    files += 1;
    console.log("[rewrite-local]", path.relative(OUT, file));
  }
}

console.log(`[rewrite-local] fixed html files=${files}`);
