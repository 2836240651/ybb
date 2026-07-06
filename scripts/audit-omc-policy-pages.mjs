/**
 * OMC Shopify policy page layout audit
 * Run: node scripts/audit-omc-policy-pages.mjs
 */
import { createRequire } from "module";
import { writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const require = createRequire(import.meta.url);
const { chromium } = require("../../scripts/node_modules/playwright");

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const OUT = join(__dirname, "omc-policy-pages-audit.json");

const PAGES = [
  { key: "refund", url: "https://www.omctackle.com/policies/refund-policy" },
  { key: "privacy", url: "https://www.omctackle.com/policies/privacy-policy" },
  { key: "shipping", url: "https://www.omctackle.com/policies/shipping-policy" },
];

function cs(el) {
  if (!el) return null;
  const s = getComputedStyle(el);
  const r = el.getBoundingClientRect();
  return {
    tag: el.tagName.toLowerCase(),
    className: (el.className?.toString?.() || "").slice(0, 200),
    width: Math.round(r.width),
    height: Math.round(r.height),
    padding: `${s.paddingTop} ${s.paddingRight} ${s.paddingBottom} ${s.paddingLeft}`,
    margin: `${s.marginTop} ${s.marginRight} ${s.marginBottom} ${s.marginLeft}`,
    maxWidth: s.maxWidth,
    fontSize: s.fontSize,
    fontWeight: s.fontWeight,
    lineHeight: s.lineHeight,
    color: s.color,
    textAlign: s.textAlign,
  };
}

async function auditPage(page, { key, url }) {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForTimeout(2500);

  return page.evaluate(
    ({ key }) => {
      function cs(el) {
        if (!el) return null;
        const s = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        return {
          tag: el.tagName.toLowerCase(),
          className: (el.className?.toString?.() || "").slice(0, 200),
          width: Math.round(r.width),
          padding: `${s.paddingTop} ${s.paddingRight} ${s.paddingBottom} ${s.paddingLeft}`,
          maxWidth: s.maxWidth,
          fontSize: s.fontSize,
          fontWeight: s.fontWeight,
          lineHeight: s.lineHeight,
          textAlign: s.textAlign,
        };
      }

      const main =
        document.querySelector("main") ||
        document.querySelector(".shopify-policy__container") ||
        document.querySelector("[class*='policy']") ||
        document.querySelector(".page-width");

      const h1 = main?.querySelector("h1") || document.querySelector("h1");
      const body = main?.querySelector(".rte, .shopify-policy__body, article") || main;
      const h2s = [...(body?.querySelectorAll("h2, h3, strong") || [])].slice(0, 8);
      const trustLike = [...document.querySelectorAll("section, div")].filter((el) =>
        /factory|service bar|trust|quality/i.test(el.textContent || "")
      ).length;

      return {
        key,
        title: document.title,
        h1: h1?.textContent?.trim(),
        main: cs(main),
        h1Style: cs(h1),
        body: cs(body),
        bodyHtmlSnippet: body?.innerHTML?.slice(0, 1200),
        sectionHeadings: h2s.map((el) => ({
          tag: el.tagName,
          text: (el.textContent || "").trim().slice(0, 80),
          style: cs(el),
        })),
        hasTrustSection: trustLike > 0,
        childCount: main?.children?.length ?? 0,
      };
    },
    { key }
  );
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const results = [];

  for (const p of PAGES) {
    console.log("Auditing", p.url);
    try {
      results.push(await auditPage(page, p));
    } catch (e) {
      results.push({ key: p.key, error: String(e) });
    }
  }

  await browser.close();
  writeFileSync(OUT, JSON.stringify({ capturedAt: new Date().toISOString(), results }, null, 2));
  console.log("Wrote", OUT);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
