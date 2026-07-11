#!/usr/bin/env node
/** Set Woo featured images for live SKUs via REST (CDP nonce). */
import fs from "fs";
import { createRequire } from "module";
const require = createRequire("D:\\dev\\独立站上架\\wordpress\\package.json");
const { chromium } = require("playwright");

const SITE = "https://carp-ybb.com";
const CDP_PORT = 9223;
const MEDIA_MAP_PATH = "D:\\dev\\独立站上架\\output\\wp\\image-media-id-map.json";

const LIVE_SKUS = ["TZ-HK-001", "TZ-ZJ-002", "TZ-ELDZ-013", "TZ-XZ-014", "TZ-XZ-004"];

async function main() {
  const mediaIdMap = JSON.parse(fs.readFileSync(MEDIA_MAP_PATH, "utf8"));
  const browser = await chromium.connectOverCDP(`http://127.0.0.1:${CDP_PORT}`);
  const ctx = browser.contexts()[0];
  const page = ctx.pages().find((p) => p.url().includes("carp-ybb.com")) || (await ctx.newPage());
  await page.goto(`${SITE}/wp-admin/`, { waitUntil: "domcontentloaded", timeout: 120000 });
  if (page.url().includes("wp-login")) throw new Error("Not logged in to wp-admin");
  const nonce = await page.evaluate(() => window.wpApiSettings?.nonce || "");
  if (!nonce) throw new Error("Missing REST nonce");
  const request = page.request;

  for (const sku of LIVE_SKUS) {
    const mediaId = mediaIdMap[sku];
    if (!mediaId) throw new Error(`No media id for ${sku}`);
    const search = await request.get(
      `${SITE}/wp-json/wc/v3/products?sku=${encodeURIComponent(sku)}&per_page=1`,
      { headers: { "X-WP-Nonce": nonce } }
    );
    let productId = 0;
    if (search.ok()) {
      const items = await search.json();
      productId = items[0]?.id || 0;
    }
    if (!productId) {
      const store = await request.get(
        `${SITE}/wp-json/wc/store/v1/products?per_page=100`,
        { headers: { "X-WP-Nonce": nonce } }
      );
      const items = await store.json();
      productId = items.find((p) => p.sku === sku)?.id || 0;
    }
    if (!productId) throw new Error(`Product not found for SKU ${sku}`);

    const resp = await request.put(`${SITE}/wp-json/wc/v3/products/${productId}`, {
      headers: { "X-WP-Nonce": nonce, "Content-Type": "application/json" },
      data: { images: [{ id: mediaId }] },
    });
    if (!resp.ok()) {
      const text = await resp.text();
      throw new Error(`Set image failed ${sku}: HTTP ${resp.status()} ${text.slice(0, 200)}`);
    }
    console.log(`[set-image] ${sku} product #${productId} media #${mediaId}`);
  }
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
