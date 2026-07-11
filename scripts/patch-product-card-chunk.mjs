#!/usr/bin/env node
/** Patch deployed ProductCard chunk: images[0] -> resolve fallback chain */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CHUNK = path.join(
  ROOT,
  "out/_next/static/chunks/e4d125c24d901e39.js"
);

const OLD = "src:d.images[0],alt:y";
const NEW =
  'src:d.images&&d.images[0]?d.images[0]:"/products/".concat(d.handle,"/master.webp"),alt:y';

let text = fs.readFileSync(CHUNK, "utf8");
if (!text.includes(OLD)) {
  console.error("[patch-product-card-chunk] pattern not found");
  process.exit(1);
}
text = text.replace(OLD, NEW);
fs.writeFileSync(CHUNK, text, "utf8");
console.log("[patch-product-card-chunk] OK");
