/**
 * OMC PDP add-to-cart button audit
 * Run: node scripts/audit-omc-pdp-atc.mjs
 */
import { chromium } from "playwright";
import { writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "omc-pdp-atc-audit.json");

/** @param {import('playwright').ElementHandle | null} el */
async function probe(el) {
  if (!el) return null;
  return el.evaluate((node) => {
    const s = getComputedStyle(node);
    const r = node.getBoundingClientRect();
    const before = node.querySelector("::before");
    return {
      tag: node.tagName.toLowerCase(),
      className: (node.className?.toString?.() || "").slice(0, 240),
      text: (node.textContent || "").trim().slice(0, 80),
      color: s.color,
      backgroundColor: s.backgroundColor,
      fontSize: s.fontSize,
      fontWeight: s.fontWeight,
      lineHeight: s.lineHeight,
      padding: s.padding,
      borderRadius: s.borderRadius,
      boxShadow: s.boxShadow,
      transition: s.transition,
      position: s.position,
      zIndex: s.zIndex,
      width: Math.round(r.width),
      height: Math.round(r.height),
    };
  });
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

const urls = [
  "https://www.omctackle.com/products/rod-rack-wall-mount",
  "https://www.omctackle.com/collections/all",
];

const results = { auditDate: new Date().toISOString().slice(0, 10), viewport: "1440x900", probes: {} };

for (const url of urls) {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForTimeout(3000);

  if (url.includes("/products/")) {
    const btn = await page.$('button[name="add"]');
    const before = await probe(btn);
    await btn?.hover();
    await page.waitForTimeout(500);
    const after = await probe(btn);
    results.probes.pdpAddToCart = { url, before, after };
  } else {
    const link = await page.$('a[href*="/products/"]');
    if (link) {
      const href = await link.getAttribute("href");
      const pdp = href.startsWith("http") ? href : `https://www.omctackle.com${href}`;
      await page.goto(pdp, { waitUntil: "domcontentloaded", timeout: 120000 });
      await page.waitForTimeout(3000);
      const btn = await page.$('button[name="add"]');
      const before = await probe(btn);
      await btn?.hover();
      await page.waitForTimeout(500);
      const after = await probe(btn);
      results.probes.pdpAddToCart = { url: pdp, before, after };
    }
  }
}

writeFileSync(OUT, JSON.stringify(results, null, 2));
console.log("Wrote", OUT);
console.log(JSON.stringify(results.probes.pdpAddToCart, null, 2));
await browser.close();
