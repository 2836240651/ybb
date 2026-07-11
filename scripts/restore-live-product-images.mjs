#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC_DIR = "D:\\dev\\独立站上架\\output\\wp\\images";
const PRODUCTS_JSON = path.join(ROOT, "lib", "data", "products.json");

const LIVE = [
  { handle: "tz-hk-001", file: "TZ-HK-001.jpeg" },
  { handle: "tz-zj-002", file: "TZ-ZJ-002.jpeg" },
  { handle: "tz-eldz-013", file: "TZ-ELDZ-013.jpeg" },
  { handle: "tz-xz-014", file: "TZ-XZ-014.png" },
  { handle: "tz-xz-004", file: "TZ-XZ-004.jpeg" },
];

let text = fs.readFileSync(PRODUCTS_JSON, "utf8");

for (const item of LIVE) {
  const src = path.join(SRC_DIR, item.file);
  const outDir = path.join(ROOT, "public", "products", item.handle);
  const outPath = path.join(outDir, "master.webp");
  fs.mkdirSync(outDir, { recursive: true });
  await sharp(src).rotate().webp({ quality: 82 }).toFile(outPath);
  const publicUrl = `/products/${item.handle}/master.webp`;
  const blockRe = new RegExp(
    `("handle": "${item.handle}"[\\s\\S]*?"images": \\[\\n?\\s*)("[^"]*")`,
    "m"
  );
  if (!blockRe.test(text)) throw new Error(`handle block not found: ${item.handle}`);
  text = text.replace(blockRe, `$1"${publicUrl}"`);
  console.log(`[restore-images] ${item.handle} -> ${publicUrl}`);
}

fs.writeFileSync(PRODUCTS_JSON, text, "utf8");
console.log("[restore-images] patched products.json (regex)");
