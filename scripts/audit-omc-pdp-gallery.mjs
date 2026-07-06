/**
 * OMC PDP product gallery audit — thumbnails + main hero layout
 * Run: node scripts/audit-omc-pdp-gallery.mjs
 * Output: scripts/omc-pdp-gallery-audit.json
 *
 * Note: OMC live at lg+ hides `.product__thumbnails` and shows a 2-col image grid.
 * Mobile/tablet (<1024) uses horizontal thumb strip below main hero.
 */
import { createRequire } from "module";
import { mkdirSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const require = createRequire(import.meta.url);
const { chromium } = require("../../scripts/node_modules/playwright");

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const PDP_URL = "https://www.omctackle.com/products/black-pearl-carp-rods";
const OUT_JSON = join(__dirname, "omc-pdp-gallery-audit.json");
const SHOT_DIR = join(ROOT, "audit-screenshots", "pdp-gallery");

const VIEWPORTS = [
  { label: "desktop-1440", width: 1440, height: 900 },
  { label: "mobile-390", width: 390, height: 844 },
];

/** @param {import('playwright').Page} page */
async function dismissOverlays(page) {
  try {
    const close = page.locator(
      "button[aria-label*='close' i], button[aria-label*='Close' i], [class*='cookie'] button"
    );
    if ((await close.count()) > 0) {
      await close.first().click({ timeout: 2000 });
      await page.waitForTimeout(400);
    }
  } catch {
    /* ignore */
  }
}

/** @param {import('playwright').Page} page */
async function measureGallery(page, viewportLabel) {
  return page.evaluate((viewportLabel) => {
    function probe(el) {
      if (!el) return null;
      const s = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return {
        tag: el.tagName.toLowerCase(),
        class: (el.className?.toString?.() || "").slice(0, 240),
        rect: {
          w: Math.round(r.width),
          h: Math.round(r.height),
          l: Math.round(r.left),
          t: Math.round(r.top),
        },
        layout: {
          display: s.display,
          flexDirection: s.flexDirection,
          gridTemplateColumns: s.gridTemplateColumns,
          gap: s.gap,
          rowGap: s.rowGap,
          columnGap: s.columnGap,
          overflow: s.overflow,
          overflowY: s.overflowY,
          maxHeight: s.maxHeight,
        },
        visual: {
          borderRadius: s.borderRadius,
          border: s.border,
          boxShadow: s.boxShadow,
          opacity: s.opacity,
          outline: s.outline,
        },
        transition: s.transition,
      };
    }

    const mediaRoot = document.querySelector(".product__media");
    if (!mediaRoot) return { viewportLabel, error: "No .product__media root found" };

    const thumbStrip = document.querySelector(".product__thumbnails");
    const thumbList = document.querySelector(".product__thumbnails-list");
    const thumbButtons = [...document.querySelectorAll(".product__thumbnails button")].filter(
      (b) => b.getBoundingClientRect().width > 0
    );

    const visibleImgs = [...document.querySelectorAll(".product__media img")].filter(
      (img) => img.getBoundingClientRect().width > 50 && getComputedStyle(img).opacity !== "0"
    );
    const mainImg =
      visibleImgs.sort(
        (a, b) =>
          b.getBoundingClientRect().width * b.getBoundingClientRect().height -
          a.getBoundingClientRect().width * a.getBoundingClientRect().height
      )[0] || document.querySelector(".product__media img");

    const activeThumb =
      thumbButtons.find((b) => b.getAttribute("aria-current") === "true") || thumbButtons[0];

    const allMediaImgs = [...document.querySelectorAll(".product__media img")];

    return {
      viewportLabel,
      mediaRoot: probe(mediaRoot),
      thumbStrip: probe(thumbStrip),
      thumbList: probe(thumbList),
      mainImage: probe(mainImg),
      thumbCount: thumbButtons.length,
      totalImageNodes: allMediaImgs.length,
      firstThumb: probe(thumbButtons[0]),
      activeThumb: probe(activeThumb),
      thumbGap: thumbList ? getComputedStyle(thumbList).gap : null,
      layoutRelation:
        thumbStrip && mainImg
          ? {
              thumbsVisible: getComputedStyle(thumbStrip).display !== "none",
              thumbsLeftOfMain:
                thumbStrip.getBoundingClientRect().right <=
                mainImg.getBoundingClientRect().left + 4,
              thumbsBelowMain:
                thumbStrip.getBoundingClientRect().top >=
                mainImg.getBoundingClientRect().bottom - 4,
              gapPx: Math.round(
                Math.abs(
                  thumbStrip.getBoundingClientRect().top -
                    mainImg.getBoundingClientRect().bottom
                )
              ),
            }
          : null,
      desktopGridMode:
        getComputedStyle(thumbStrip || document.body).display === "none" &&
        allMediaImgs.filter((i) => getComputedStyle(i).opacity !== "0").length > 1,
    };
  }, viewportLabel);
}

/** @param {import('playwright').Page} page */
async function testThumbClick(page) {
  const before = await page.evaluate(() => {
    const main = document.querySelector(".product__media img");
    return main?.getAttribute("src")?.slice(-50) || null;
  });

  const clicked = await page.evaluate(() => {
    const thumbs = [...document.querySelectorAll(".product__thumbnails button")].filter(
      (b) => b.getBoundingClientRect().width > 0
    );
    if (thumbs.length < 2) return { ok: false, reason: "fewer than 2 visible thumbs" };
    thumbs[1].click();
    return { ok: true, index: 1 };
  });

  await page.waitForTimeout(700);

  const after = await page.evaluate(() => {
    const main = document.querySelector(".product__media img");
    const active = document.querySelector(".product__thumbnails button[aria-current='true']");
    const s = active ? getComputedStyle(active) : null;
    return {
      mainSrcTail: main?.getAttribute("src")?.slice(-50) || null,
      activeThumb: active
        ? {
            ariaCurrent: active.getAttribute("aria-current"),
            border: s?.border,
            opacity: s?.opacity,
            borderRadius: s?.borderRadius,
          }
        : null,
    };
  });

  return { clicked, before, after, mainChanged: before !== after.mainSrcTail };
}

const browser = await chromium.launch();
const results = {
  auditDate: new Date().toISOString(),
  url: PDP_URL,
  note: "OMC lg+ uses 2-col masonry grid (thumbs hidden). Mobile uses horizontal 62px thumbs below main.",
  viewports: {},
  clickBehavior: null,
};

mkdirSync(SHOT_DIR, { recursive: true });

for (const vp of VIEWPORTS) {
  const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
  await page.goto(PDP_URL, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForTimeout(4000);
  await dismissOverlays(page);

  results.viewports[vp.label] = await measureGallery(page, vp.label);

  const shotPath = join(SHOT_DIR, `omc-${vp.label}.png`);
  await page.screenshot({ path: shotPath, fullPage: false });
  results.viewports[vp.label].screenshot = shotPath;

  if (vp.label === "mobile-390") {
    results.clickBehavior = await testThumbClick(page);
    results.viewports[vp.label].afterClick = await measureGallery(page, vp.label);
  }

  await page.close();
}

writeFileSync(OUT_JSON, JSON.stringify(results, null, 2));
console.log("Wrote", OUT_JSON);
console.log(JSON.stringify(results, null, 2));
await browser.close();
