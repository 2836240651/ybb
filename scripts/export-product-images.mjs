/**
 * Export compressed master product images from cloud-drive sources to public/products/.
 * Read-only on source paths — never modifies E:\迅雷云盘\...
 *
 * Usage:
 *   node scripts/export-product-images.mjs --limit 20
 *   node scripts/export-product-images.mjs --all
 *   node scripts/export-product-images.mjs --all --no-update-json
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const CSV_PATH = join(__dirname, "../../assets-manifest.csv");
const PRODUCTS_PATH = join(ROOT, "lib/data/products.json");
const PUBLIC_PRODUCTS = join(ROOT, "public/products");
const PLACEHOLDER_PATH = join(ROOT, "public/images/placeholder-product.jpg");

const MAX_EDGE = 1200;
const TARGET_MIN_KB = 100;
const TARGET_MAX_KB = 300;
const MASTER_FILENAME = "master.webp";

function parseArgs() {
  const args = process.argv.slice(2);
  const limitIdx = args.indexOf("--limit");
  const all = args.includes("--all");
  const noUpdateJson = args.includes("--no-update-json");
  let limit = null;
  if (limitIdx !== -1) {
    limit = parseInt(args[limitIdx + 1], 10);
    if (Number.isNaN(limit) || limit < 1) {
      console.error("Invalid --limit value");
      process.exit(1);
    }
  }
  if (!all && limit == null) {
    console.error("Specify --limit N or --all");
    process.exit(1);
  }
  return { limit, all, noUpdateJson };
}

function parseCsv(text) {
  const lines = text.trim().split("\n");
  const headers = lines[0].split(",");
  return lines.slice(1).map((line) => {
    const cols = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') inQuotes = !inQuotes;
      else if (ch === "," && !inQuotes) {
        cols.push(cur);
        cur = "";
      } else cur += ch;
    }
    cols.push(cur);
    const row = {};
    headers.forEach((h, i) => {
      row[h.trim()] = (cols[i] ?? "").trim();
    });
    return row;
  });
}

async function exportImage(sourcePath, destPath) {
  const pipeline = sharp(sourcePath, { failOn: "none" }).rotate();
  const meta = await pipeline.metadata();
  const w = meta.width ?? MAX_EDGE;
  const h = meta.height ?? MAX_EDGE;
  const scale = Math.min(1, MAX_EDGE / Math.max(w, h));

  let quality = 82;
  let buffer;
  let sizeKb;

  for (let attempt = 0; attempt < 12; attempt++) {
    buffer = await sharp(sourcePath, { failOn: "none" })
      .rotate()
      .resize({
        width: scale < 1 ? Math.round(w * scale) : undefined,
        height: scale < 1 ? Math.round(h * scale) : undefined,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality, effort: 4 })
      .toBuffer();

    sizeKb = buffer.length / 1024;
    if (sizeKb <= TARGET_MAX_KB) break;
    quality -= 6;
    if (quality < 50) break;
  }

  writeFileSync(destPath, buffer);
  return { sizeKb: Math.round(sizeKb), quality };
}

async function ensurePlaceholder() {
  mkdirSync(dirname(PLACEHOLDER_PATH), { recursive: true });
  if (!existsSync(PLACEHOLDER_PATH)) {
    await sharp({
      create: {
        width: 800,
        height: 1000,
        channels: 3,
        background: { r: 240, g: 240, b: 240 },
      },
    })
      .jpeg({ quality: 80 })
      .toFile(PLACEHOLDER_PATH);
    console.log("Created placeholder:", PLACEHOLDER_PATH);
  }
}

async function main() {
  const { limit, all, noUpdateJson } = parseArgs();
  await ensurePlaceholder();

  const products = JSON.parse(readFileSync(PRODUCTS_PATH, "utf-8"));
  const csvRows = parseCsv(readFileSync(CSV_PATH, "utf-8"));
  const csvByHandle = Object.fromEntries(csvRows.map((r) => [r.handle, r]));

  const queue = all ? products : products.slice(0, limit);
  const results = { ok: [], skip: [], fail: [] };

  for (const product of queue) {
    const handle = product.handle;
    const csvRow = csvByHandle[handle];
    const sourcePath =
      product.sourceImage || csvRow?.primary_image || "";

    if (!sourcePath) {
      results.skip.push({ handle, reason: "no source path" });
      continue;
    }
    if (!existsSync(sourcePath)) {
      results.fail.push({ handle, reason: `source not found: ${sourcePath}` });
      continue;
    }

    const outDir = join(PUBLIC_PRODUCTS, handle);
    const outPath = join(outDir, MASTER_FILENAME);
    const publicUrl = `/products/${handle}/${MASTER_FILENAME}`;

    try {
      mkdirSync(outDir, { recursive: true });
      const { sizeKb, quality } = await exportImage(sourcePath, outPath);
      results.ok.push({ handle, sizeKb, quality, publicUrl });

      if (!noUpdateJson) {
        const idx = products.findIndex((p) => p.handle === handle);
        if (idx !== -1) {
          products[idx].images = [publicUrl];
        }
      }
      console.log(`✓ ${handle} → ${sizeKb}KB (q=${quality})`);
    } catch (err) {
      results.fail.push({ handle, reason: String(err.message || err) });
      console.error(`✗ ${handle}:`, err.message || err);
    }
  }

  if (!noUpdateJson && results.ok.length > 0) {
    writeFileSync(PRODUCTS_PATH, JSON.stringify(products, null, 2) + "\n");
    console.log(`Updated products.json for ${results.ok.length} items`);
  }

  console.log("\n--- Summary ---");
  console.log(`Exported: ${results.ok.length}`);
  console.log(`Skipped:  ${results.skip.length}`);
  console.log(`Failed:   ${results.fail.length}`);
  if (results.fail.length) {
    console.log("Failures:", results.fail.slice(0, 10));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
