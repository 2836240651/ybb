/**
 * Mobile viewport audit — detect horizontal overflow / layout squeeze on carp-ybb.com.
 *
 * Usage:
 *   node scripts/audit-mobile-viewports.mjs
 *   node scripts/audit-mobile-viewports.mjs --site http://localhost:3000
 */
import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const OUT_DIR = join(ROOT, "scripts", ".audit-output", "mobile-viewports");
const SITE = process.argv.includes("--site")
  ? process.argv[process.argv.indexOf("--site") + 1]
  : "https://carp-ybb.com";

const VIEWPORTS = [
  { label: "320x568", width: 320, height: 568 },
  { label: "360x640", width: 360, height: 640 },
  { label: "390x844", width: 390, height: 844 },
  { label: "414x896", width: 414, height: 896 },
  { label: "430x932", width: 430, height: 932 },
];

const STATIC_PAGES = [
  { path: "/", name: "home" },
  { path: "/collections/sinkers/", name: "collection" },
  { path: "/products/tz-eldz-012", name: "pdp" },
  { path: "/products/reviews/tz-eldz-012", name: "reviews" },
  { path: "/collections/all", name: "shop-all" },
  { path: "/pages/contact", name: "contact" },
];

/** WooCommerce cart (not static export) — only when --include-wp */
const WP_PAGES = [{ path: "/cart/", name: "cart-wp" }];

const includeWp = process.argv.includes("--include-wp");
const PAGES = includeWp ? [...STATIC_PAGES, ...WP_PAGES] : STATIC_PAGES;

async function loadPlaywright() {
  const candidates = [
    "playwright",
    "D:/dev/独立站上架/wordpress/node_modules/playwright",
    join(ROOT, "node_modules/playwright"),
  ];
  for (const candidate of candidates) {
    try {
      return require(candidate);
    } catch {
      // try next
    }
  }
  throw new Error("playwright not found");
}

function findOverflowingElements() {
  const vw = document.documentElement.clientWidth;
  const offenders = [];
  const walk = (el) => {
    if (!(el instanceof HTMLElement)) return;
    const rect = el.getBoundingClientRect();
    const style = getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden") return;
    if (rect.width < 2 || rect.height < 2) return;
    const right = rect.right;
    const left = rect.left;
    if (right > vw + 2 || left < -2) {
      const tag = el.tagName.toLowerCase();
      const id = el.id ? `#${el.id}` : "";
      const cls =
        el.className && typeof el.className === "string"
          ? `.${el.className.trim().split(/\s+/).slice(0, 3).join(".")}`
          : "";
      offenders.push({
        tag,
        selector: `${tag}${id}${cls}`.slice(0, 120),
        right: Math.round(right),
        left: Math.round(left),
        width: Math.round(rect.width),
        overflowX: style.overflowX,
        position: style.position,
        text: (el.textContent || "").trim().slice(0, 60),
      });
    }
    for (const child of el.children) walk(child);
  };
  walk(document.body);
  offenders.sort((a, b) => b.right - a.right);
  const seen = new Set();
  const unique = [];
  for (const o of offenders) {
    const key = `${o.selector}|${o.right}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(o);
    if (unique.length >= 8) break;
  }
  return {
    viewportWidth: vw,
    scrollWidth: document.documentElement.scrollWidth,
    hasHorizontalOverflow: document.documentElement.scrollWidth > vw + 1,
    offenders: unique,
  };
}

async function main() {
  const pw = await loadPlaywright();
  const browser = await pw.chromium.launch({ headless: true });
  const results = [];

  await mkdir(OUT_DIR, { recursive: true });

  for (const vp of VIEWPORTS) {
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      isMobile: true,
      hasTouch: true,
      userAgent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
    });
    const page = await context.newPage();

    for (const pg of PAGES) {
      const url = `${SITE.replace(/\/$/, "")}${pg.path}?mobile-audit=1`;
      try {
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
        // Home hero caption animation can briefly widen scrollWidth; let it settle.
        await page.waitForTimeout(pg.name === "home" ? 4500 : 1800);
        const metrics = await page.evaluate(findOverflowingElements);
        const shot = join(OUT_DIR, `${pg.name}-${vp.label}.png`);
        await page.screenshot({ path: shot, fullPage: false });
        results.push({
          viewport: vp.label,
          page: pg.name,
          path: pg.path,
          url,
          ...metrics,
          screenshot: shot,
        });
        const flag = metrics.hasHorizontalOverflow ? "OVERFLOW" : "OK";
        console.log(
          `[${flag}] ${vp.label} ${pg.name} scroll=${metrics.scrollWidth}/${metrics.viewportWidth} offenders=${metrics.offenders.length}`
        );
      } catch (err) {
        results.push({
          viewport: vp.label,
          page: pg.name,
          path: pg.path,
          error: String(err),
        });
        console.log(`[ERR] ${vp.label} ${pg.name}: ${err.message || err}`);
      }
    }
    await context.close();
  }

  await browser.close();

  const summary = {
    site: SITE,
    auditedAt: new Date().toISOString(),
    total: results.length,
    overflowCount: results.filter((r) => r.hasHorizontalOverflow).length,
    results,
  };
  const jsonPath = join(OUT_DIR, "audit-mobile-viewports.json");
  await writeFile(jsonPath, JSON.stringify(summary, null, 2), "utf8");
  console.log(`\nWrote ${jsonPath}`);
  console.log(
    `Overflow cases: ${summary.overflowCount}/${summary.total} (see JSON for offenders)`
  );
  process.exit(summary.overflowCount > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
