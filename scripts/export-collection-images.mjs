/**
 * Export 4:5 collection atmosphere images for homepage CategoryGrid.
 * Sources (priority): product sourceImage → public/products/{handle}/master.webp
 *
 * Usage:
 *   node scripts/export-collection-images.mjs
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const COLLECTIONS_PATH = join(ROOT, "lib/data/collections.json");
const PRODUCTS_PATH = join(ROOT, "lib/data/products.json");
const OUT_DIR = join(ROOT, "public/images/collections");

const FEATURED_HANDLES = [
  "terminal-tackle",
  "ready-rigs",
  "bait-cages",
  "hooklinks",
  "leadcore",
  "tackle-bags",
];

const WIDTH = 1280;
const HEIGHT = 1600;
const MAX_EDGE = 1600;

function gradientOverlaySvg(w, h) {
  return Buffer.from(
    `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
          <stop offset="45%" stop-color="#000" stop-opacity="0"/>
          <stop offset="100%" stop-color="#000" stop-opacity="0.55"/>
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#g)"/>
    </svg>`
  );
}

function resolveSource(product, handle) {
  if (product?.sourceImage && existsSync(product.sourceImage)) {
    return { path: product.sourceImage, via: "sourceImage" };
  }
  const master = join(ROOT, "public/products", handle, "master.webp");
  if (existsSync(master)) {
    return { path: master, via: "master.webp" };
  }
  return null;
}

async function exportCollectionImage(sourcePath, destPath) {
  const base = sharp(sourcePath, { failOn: "none" }).rotate();
  const meta = await base.metadata();
  const w = meta.width ?? WIDTH;
  const h = meta.height ?? HEIGHT;
  const scale = Math.min(1, MAX_EDGE / Math.max(w, h));

  let pipeline = sharp(sourcePath, { failOn: "none" })
    .rotate()
    .resize(WIDTH, HEIGHT, { fit: "cover", position: "centre" });

  if (scale < 1 && Math.max(w, h) > MAX_EDGE) {
    pipeline = sharp(sourcePath, { failOn: "none" })
      .rotate()
      .resize({
        width: Math.round(w * scale),
        height: Math.round(h * scale),
        fit: "inside",
        withoutEnlargement: true,
      })
      .resize(WIDTH, HEIGHT, { fit: "cover", position: "centre" });
  }

  const buffer = await pipeline
    .composite([{ input: gradientOverlaySvg(WIDTH, HEIGHT), blend: "over" }])
    .webp({ quality: 82, effort: 4 })
    .toBuffer();

  writeFileSync(destPath, buffer);
  return { sizeKb: Math.round(buffer.length / 1024) };
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });

  const collections = JSON.parse(readFileSync(COLLECTIONS_PATH, "utf-8"));
  const products = JSON.parse(readFileSync(PRODUCTS_PATH, "utf-8"));
  const productsByHandle = Object.fromEntries(products.map((p) => [p.handle, p]));

  const results = { ok: [], fail: [] };

  for (const collectionHandle of FEATURED_HANDLES) {
    const collection = collections.find((c) => c.handle === collectionHandle);
    if (!collection) {
      results.fail.push({ collectionHandle, reason: "collection not found" });
      continue;
    }

    const productHandle = collection.productHandles?.[0];
    if (!productHandle) {
      results.fail.push({ collectionHandle, reason: "no products in collection" });
      continue;
    }

    const product = productsByHandle[productHandle];
    const source = resolveSource(product, productHandle);
    if (!source) {
      results.fail.push({
        collectionHandle,
        reason: `no source for product ${productHandle}`,
      });
      continue;
    }

    const destPath = join(OUT_DIR, `${collectionHandle}.webp`);

    try {
      const { sizeKb } = await exportCollectionImage(source.path, destPath);
      results.ok.push({
        collectionHandle,
        productHandle,
        via: source.via,
        sizeKb,
        publicUrl: `/images/collections/${collectionHandle}.webp`,
      });
      console.log(
        `✓ ${collectionHandle} ← ${productHandle} (${source.via}, ${sizeKb}KB)`
      );
    } catch (err) {
      results.fail.push({
        collectionHandle,
        reason: String(err.message || err),
      });
      console.error(`✗ ${collectionHandle}:`, err.message || err);
    }
  }

  console.log("\n--- Summary ---");
  console.log(`Exported: ${results.ok.length}/${FEATURED_HANDLES.length}`);
  if (results.fail.length) {
    console.log("Failures:", results.fail);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
