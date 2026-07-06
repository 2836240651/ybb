/**
 * OMC product card hover + quick view modal audit
 * Run: node scripts/audit-omc-product-card.mjs
 */
import { chromium } from "playwright";
import { writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "omc-product-card-audit.json");
const OMC = "https://www.omctackle.com/collections/all";

/** @param {import('playwright').ElementHandle | null} el */
async function capture(el) {
  if (!el) return null;
  return el.evaluate((node) => {
    const s = getComputedStyle(node);
    const r = node.getBoundingClientRect();
    return {
      tag: node.tagName.toLowerCase(),
      className: (node.className?.toString?.() || "").slice(0, 200),
      text: (node.textContent || "").trim().slice(0, 80),
      ariaLabel: node.getAttribute("aria-label"),
      href: node.getAttribute("href"),
      width: Math.round(r.width),
      height: Math.round(r.height),
      top: Math.round(r.top),
      left: Math.round(r.left),
      opacity: s.opacity,
      display: s.display,
      visibility: s.visibility,
      backgroundColor: s.backgroundColor,
      borderRadius: s.borderRadius,
      padding: s.padding,
      position: s.position,
      zIndex: s.zIndex,
      pointerEvents: s.pointerEvents,
      transition: s.transition,
      transform: s.transform,
    };
  });
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const results = { url: OMC, viewport: "1440x900" };

await page.goto(OMC, { waitUntil: "domcontentloaded", timeout: 120000 });
await page.waitForTimeout(3000);

const card = page.locator(".product-card").filter({ has: page.locator("img") }).first();
await card.scrollIntoViewIfNeeded();
await page.waitForTimeout(500);

results.cardBox = await card.boundingBox();

results.beforeHover = {
  nodes: await card.evaluate((el) =>
    [...el.querySelectorAll("button, a, svg, [class*='overlay'], [class*='quick']")].map((n) => {
      const s = getComputedStyle(n);
      const r = n.getBoundingClientRect();
      return {
        tag: n.tagName,
        className: (n.className?.toString?.() || "").slice(0, 120),
        text: (n.textContent || "").trim().slice(0, 60),
        ariaLabel: n.getAttribute("aria-label"),
        href: n.getAttribute("href"),
        opacity: s.opacity,
        visibility: s.visibility,
        width: Math.round(r.width),
        height: Math.round(r.height),
      };
    })
  ),
};

await card.hover();
await page.waitForTimeout(600);

results.afterHover = {
  nodes: await card.evaluate((el) =>
    [...el.querySelectorAll("button, a, svg, [class*='overlay'], [class*='quick']")].map((n) => {
      const s = getComputedStyle(n);
      const r = n.getBoundingClientRect();
      return {
        tag: n.tagName,
        className: (n.className?.toString?.() || "").slice(0, 120),
        text: (n.textContent || "").trim().slice(0, 60),
        ariaLabel: n.getAttribute("aria-label"),
        href: n.getAttribute("href"),
        opacity: s.opacity,
        visibility: s.visibility,
        backgroundColor: s.backgroundColor,
        borderRadius: s.borderRadius,
        padding: s.padding,
        width: Math.round(r.width),
        height: Math.round(r.height),
        top: Math.round(r.top),
        left: Math.round(r.left),
        hasSvg: !!n.querySelector("svg"),
      };
    })
  ),
  eyeButton: await capture(
    await card.locator("button:has(svg), .quick-view__button, [class*='quick-view']").first().elementHandle().catch(() => null)
  ),
  imageLink: await capture(
    await card.locator('a[href*="/products/"]').first().elementHandle().catch(() => null)
  ),
};

const qvBtn = card.locator("button:has(svg.icon-eye), button:has(svg), .quick-view__button").first();
if ((await qvBtn.count()) > 0) {
  await qvBtn.click({ force: true });
  await page.waitForTimeout(1200);

  results.modal = await page.evaluate(() => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const visible = (n) => {
      const s = getComputedStyle(n);
      const r = n.getBoundingClientRect();
      return s.display !== "none" && s.visibility !== "hidden" && parseFloat(s.opacity) > 0.05 && r.width > 50;
    };
    const modals = [...document.querySelectorAll("[role='dialog'], dialog, [class*='quick-view'], [class*='drawer']")].filter(visible);
    return {
      viewport: { width: vw, height: vh, center: { x: vw / 2, y: vh / 2 } },
      modals: modals.map((n) => {
        const s = getComputedStyle(n);
        const r = n.getBoundingClientRect();
        return {
          tag: n.tagName,
          className: (n.className?.toString?.() || "").slice(0, 150),
          position: s.position,
          top: Math.round(r.top),
          left: Math.round(r.left),
          width: Math.round(r.width),
          height: Math.round(r.height),
          transform: s.transform,
          zIndex: s.zIndex,
          offsetFromCenter: {
            x: Math.round(r.left + r.width / 2 - vw / 2),
            y: Math.round(r.top + r.height / 2 - vh / 2),
          },
        };
      }),
      backdrops: [...document.querySelectorAll("[class*='overlay'], [class*='backdrop']")]
        .filter(visible)
        .map((n) => ({
          className: (n.className?.toString?.() || "").slice(0, 120),
          opacity: getComputedStyle(n).opacity,
          backgroundColor: getComputedStyle(n).backgroundColor,
        })),
      closeBtn: (() => {
        const btn = document.querySelector('button[aria-label*="Close" i], button[class*="close"]');
        if (!btn) return null;
        const s = getComputedStyle(btn);
        const r = btn.getBoundingClientRect();
        return {
          className: btn.className?.toString?.().slice(0, 120),
          width: Math.round(r.width),
          height: Math.round(r.height),
          borderRadius: s.borderRadius,
        };
      })(),
    };
  });
}

writeFileSync(OUT, JSON.stringify(results, null, 2));
console.log(`Wrote ${OUT}`);
await browser.close();
