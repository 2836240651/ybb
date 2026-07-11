#!/usr/bin/env node
/**
 * Upload local product images to WP media via REST (CDP session, skip login form).
 * Usage: node scripts/upload-live-images-wp.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";
const require = createRequire("D:\\dev\\独立站上架\\wordpress\\package.json");
const { chromium } = require("playwright");

const SITE = "https://carp-ybb.com";
const CDP_PORT = 9223;
const SRC_DIR = "D:\\dev\\独立站上架\\output\\wp\\images";
const MAP_PATH = "D:\\dev\\独立站上架\\output\\wp\\image-url-map.json";
const MEDIA_MAP_PATH = "D:\\dev\\独立站上架\\output\\wp\\image-media-id-map.json";

const LIVE = [
  { sku: "TZ-HK-001", file: "TZ-HK-001.jpeg" },
  { sku: "TZ-ZJ-002", file: "TZ-ZJ-002.jpeg" },
  { sku: "TZ-ELDZ-013", file: "TZ-ELDZ-013.jpeg" },
  { sku: "TZ-XZ-014", file: "TZ-XZ-014.png" },
  { sku: "TZ-XZ-004", file: "TZ-XZ-004.jpeg" },
];

function mimeFor(file) {
  const ext = path.extname(file).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  return "image/jpeg";
}

async function main() {
  const browser = await chromium.connectOverCDP(`http://127.0.0.1:${CDP_PORT}`);
  const ctx = browser.contexts()[0];
  if (!ctx) throw new Error("No CDP context — run: cd D:\\dev\\独立站上架\\wordpress && npm run open-chrome");
  const page = ctx.pages().find((p) => p.url().includes("carp-ybb.com")) || (await ctx.newPage());
  await page.goto(`${SITE}/wp-admin/`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForTimeout(2000);
  if (page.url().includes("wp-login")) {
    throw new Error("Not logged in — log into wp-admin in Chrome CDP window first");
  }
  const nonce = await page.evaluate(() => window.wpApiSettings?.nonce || "");
  if (!nonce) throw new Error("Missing REST nonce");

  const urlMap = fs.existsSync(MAP_PATH) ? JSON.parse(fs.readFileSync(MAP_PATH, "utf8")) : {};
  const mediaIdMap = fs.existsSync(MEDIA_MAP_PATH) ? JSON.parse(fs.readFileSync(MEDIA_MAP_PATH, "utf8")) : {};
  const request = page.request;

  for (const item of LIVE) {
    const filePath = path.join(SRC_DIR, item.file);
    const buffer = fs.readFileSync(filePath);
    const uploadName = `${item.sku}${path.extname(item.file)}`;
    const resp = await request.post(`${SITE}/wp-json/wp/v2/media`, {
      headers: {
        "X-WP-Nonce": nonce,
        "Content-Disposition": `attachment; filename="${uploadName}"`,
      },
      multipart: {
        file: { name: uploadName, mimeType: mimeFor(item.file), buffer },
      },
      timeout: 120000,
    });
    if (!resp.ok()) {
      const text = await resp.text();
      throw new Error(`${item.sku} upload failed HTTP ${resp.status()}: ${text.slice(0, 200)}`);
    }
    const json = await resp.json();
    const url = json.source_url?.split("?")[0];
    urlMap[item.sku] = url;
    mediaIdMap[item.sku] = json.id;
    console.log(`[wp-upload] ${item.sku} -> #${json.id} ${url}`);
  }

  fs.writeFileSync(MAP_PATH, JSON.stringify(urlMap, null, 2) + "\n");
  fs.writeFileSync(MEDIA_MAP_PATH, JSON.stringify(mediaIdMap, null, 2) + "\n");
  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
