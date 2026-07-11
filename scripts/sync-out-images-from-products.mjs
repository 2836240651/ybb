#!/usr/bin/env node
/** Sync out/*.html product image URLs from lib/data/products.json */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "out");
const products = JSON.parse(
  fs.readFileSync(path.join(ROOT, "lib/data/products.json"), "utf8")
);

const byHandle = Object.fromEntries(
  products.map((p) => [p.handle, p.images?.[0]].filter(Boolean))
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
  for (const [handle, url] of Object.entries(byHandle)) {
    if (!url) continue;
    text = text.split(`/products/${handle}/master.webp`).join(url);
    text = text.split(`/products/${handle}/master.webp.jpeg`).join(url);
    text = text.split(`/products/${handle}/master.webp.png`).join(url);
  }
  if (text !== before) {
    fs.writeFileSync(file, text, "utf8");
    files += 1;
    console.log("[sync-out-images]", path.relative(OUT, file));
  }
}
console.log(`[sync-out-images] html files=${files}`);
