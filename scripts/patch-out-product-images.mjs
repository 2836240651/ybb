#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "out");
const products = JSON.parse(fs.readFileSync(path.join(ROOT, "lib/data/products.json"), "utf8"));

const newUrlBySku = Object.fromEntries(products.map((p) => [p.sku, p.images[0]]));

const OLD_PATTERNS = [
  /https:\/\/carp-ybb\.com\/wp-content\/uploads\/2026\/07\/[^"'\s>\\]+/g,
  /https:\/\/carp-ybb\.com\/wp-content\/uploads\/2026\/06\/TZ-(HK|ZJ|ELDZ|XZ)-[^"'\s>\\]+/g,
];

function walk(dir, acc = []) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    if (fs.statSync(p).isDirectory()) walk(p, acc);
    else if (name.endsWith(".html")) acc.push(p);
  }
  return acc;
}

function resolveUrl(match) {
  for (const sku of Object.keys(newUrlBySku)) {
    if (match.includes(sku)) return newUrlBySku[sku];
  }
  if (match.includes("三角") || match.includes("%E4%B8%89%E8%A7%92")) return newUrlBySku["TZ-HK-001"];
  if (match.includes("TZ-ZJ-021")) return newUrlBySku["TZ-XZ-004"];
  return null;
}

let touched = 0;
for (const file of walk(OUT)) {
  let text = fs.readFileSync(file, "utf8");
  const before = text;
  for (const re of OLD_PATTERNS) {
    text = text.replace(re, (m) => resolveUrl(m) || m);
  }
  for (const [sku, url] of Object.entries(newUrlBySku)) {
    text = text.split(`https://carp-ybb.com/wp-content/uploads/2026/06/${sku}.jpeg`).join(url);
    text = text.split(`https://carp-ybb.com/wp-content/uploads/2026/06/${sku}.png`).join(url);
    text = text.split(`https://carp-ybb.com/wp-content/uploads/2026/07/${sku}.jpeg`).join(url);
    text = text.split(`https://carp-ybb.com/wp-content/uploads/2026/07/${sku}.png`).join(url);
  }
  if (text !== before) {
    fs.writeFileSync(file, text, "utf8");
    touched += 1;
    console.log(`[patch-out] ${path.relative(OUT, file)}`);
  }
}
console.log(`[patch-out] done touched=${touched}`);
