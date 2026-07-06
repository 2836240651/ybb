/**
 * Import wholesale collection carousel images (12 categories).
 *
 * Maps source images (sorted by filename) to catalog handles, outputs
 * public/images/collections/{handle}.webp (4:5, ~1280×1600).
 *
 * Usage:
 *   node scripts/import-wholesale-collection-images.mjs
 *   node scripts/import-wholesale-collection-images.mjs --source "C:\path\to\Wholesale collections"
 *   node scripts/import-wholesale-collection-images.mjs --fetch-production
 */

import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import https from "https";
import sharp from "sharp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const OUT_DIR = join(ROOT, "public/images/collections");
const TAXONOMY_PATH = join(ROOT, "lib/data/catalog-taxonomy.json");

const DEFAULT_SOURCE =
  "C:\\Users\\Administrator\\xwechat_files\\wxid_qgns91oaa64422_b1a0\\msg\\file\\2026-06\\Wholesale collections\\Wholesale collections";

const WIDTH = 1280;
const HEIGHT = 1600;
const IMAGE_EXT = /\.(jpe?g|png|webp|gif)$/i;

function loadHandles() {
  const taxonomy = JSON.parse(readFileSync(TAXONOMY_PATH, "utf-8"));
  const main = taxonomy.mainCategories.map((c) => c.handle);
  const otherChildren = taxonomy.other?.children?.map((c) => c.handle) ?? [];
  return [...main, ...otherChildren];
}

function listSourceImages(sourceDir) {
  if (!existsSync(sourceDir)) {
    return [];
  }
  return readdirSync(sourceDir)
    .filter((name) => IMAGE_EXT.test(name))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    .map((name) => join(sourceDir, name));
}

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

async function exportWebp(sourcePath, destPath) {
  const buffer = await sharp(sourcePath, { failOn: "none" })
    .rotate()
    .resize(WIDTH, HEIGHT, { fit: "cover", position: "centre" })
    .composite([{ input: gradientOverlaySvg(WIDTH, HEIGHT), blend: "over" }])
    .webp({ quality: 82, effort: 4 })
    .toBuffer();

  writeFileSync(destPath, buffer);
  return Math.round(buffer.length / 1024);
}

function fetchBuffer(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode} for ${url}`));
          res.resume();
          return;
        }
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => resolve(Buffer.concat(chunks)));
      })
      .on("error", reject);
  });
}

async function fetchProduction(handles) {
  mkdirSync(OUT_DIR, { recursive: true });
  const ok = [];
  const fail = [];
  for (const handle of handles) {
    const url = `https://carp-ybb.com/images/collections/${handle}.webp`;
    const dest = join(OUT_DIR, `${handle}.webp`);
    try {
      const buf = await fetchBuffer(url);
      writeFileSync(dest, buf);
      ok.push(handle);
      console.log(`✓ fetched ${handle} (${Math.round(buf.length / 1024)}KB)`);
    } catch (err) {
      fail.push({ handle, reason: err.message });
      console.warn(`✗ ${handle}: ${err.message}`);
    }
  }
  return { ok, fail };
}

function parseArgs(argv) {
  const args = { source: DEFAULT_SOURCE, fetchProduction: false };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === "--source" && argv[i + 1]) {
      args.source = argv[++i];
    } else if (argv[i] === "--fetch-production") {
      args.fetchProduction = true;
    }
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv);
  const handles = loadHandles();

  if (handles.length !== 12) {
    console.warn(`[import] expected 12 handles, got ${handles.length}`);
  }

  mkdirSync(OUT_DIR, { recursive: true });

  if (args.fetchProduction) {
    const { ok, fail } = await fetchProduction(handles);
    console.log(`\nFetched ${ok.length}/${handles.length} from production`);
    if (fail.length) {
      console.log("Missing on production:", fail.map((f) => f.handle).join(", "));
    }
    if (ok.length === 0) {
      process.exit(1);
    }
    return;
  }

  const sources = listSourceImages(args.source);
  if (sources.length === 0) {
    console.error(`[import] No images in: ${args.source}`);
    console.error("Place 12 category images in that folder, or run with --fetch-production");
    process.exit(1);
  }

  if (sources.length !== handles.length) {
    console.warn(
      `[import] ${sources.length} images vs ${handles.length} handles — mapping by sort order`
    );
  }

  const results = { ok: [], fail: [] };
  const count = Math.min(sources.length, handles.length);

  for (let i = 0; i < count; i++) {
    const handle = handles[i];
    const sourcePath = sources[i];
    const destPath = join(OUT_DIR, `${handle}.webp`);
    try {
      const sizeKb = await exportWebp(sourcePath, destPath);
      results.ok.push({ handle, sourcePath, sizeKb });
      console.log(`✓ ${handle} ← ${sourcePath} (${sizeKb}KB)`);
    } catch (err) {
      results.fail.push({ handle, reason: String(err.message || err) });
      console.error(`✗ ${handle}:`, err.message || err);
    }
  }

  console.log(`\nImported ${results.ok.length}/${handles.length}`);
  if (results.fail.length) {
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
