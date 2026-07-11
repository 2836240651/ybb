#!/usr/bin/env node
/** Copy Woo product images into out/products/{handle}/master.webp for same-origin static serving */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "out");
const products = JSON.parse(fs.readFileSync(path.join(ROOT, "lib/data/products.json"), "utf8"));

async function download(url) {
  const res = await fetch(url, { headers: { "User-Agent": "ybb-static-sync/1.0" } });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

let ok = 0;
for (const p of products) {
  const src = p.images?.[0];
  if (!src || !src.includes("wp-content/uploads")) continue;
  const dir = path.join(OUT, "products", p.handle);
  const outPath = path.join(dir, "master.webp");
  fs.mkdirSync(dir, { recursive: true });
  const buf = await download(src);
  await sharp(buf).rotate().webp({ quality: 82 }).toFile(outPath);
  ok += 1;
  console.log(`[mirror-static] ${p.handle} -> /products/${p.handle}/master.webp`);
}

console.log(`[mirror-static] done ${ok}/${products.length}`);
