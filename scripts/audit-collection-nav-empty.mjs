/**
 * Empty collection page — header nav must keep working after client-side entry.
 * Run: node scripts/audit-collection-nav-empty.mjs
 *      node scripts/audit-collection-nav-empty.mjs --site http://localhost:3000
 */
import { createRequire } from "module";
import { writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const require = createRequire(import.meta.url);
const { chromium } = require("../../scripts/node_modules/playwright");

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_JSON = join(__dirname, "collection-nav-empty-audit.json");

const siteArg = process.argv.find((a) => a.startsWith("--site="));
const SITE = siteArg?.split("=")[1] ?? process.env.BASE_URL ?? "http://localhost:3000";

function withCacheBust(url) {
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}v=${Date.now()}`;
}

const EMPTY_HANDLE = "2026-new-products";
const TARGET_HANDLE = "rigs";
const NONEMPTY_CONTROL = "carp-hooks";

async function waitForNavLinks(page, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const count = await page.locator("nav a.nav-pill-trigger").count();
    if (count > 0) return count;
    await page.waitForTimeout(250);
  }
  return 0;
}

async function clickNavHref(page, href) {
  const link = page.locator(`nav a.nav-pill-trigger[href="${href}"]`).first();
  await link.waitFor({ state: "visible", timeout: 10000 });
  await link.click();
}

async function waitForEmptyCategory(page, timeoutMs = 15000) {
  const markers = [
    "该类目暂无商品",
    "No products in this category yet.",
    "このカテゴリには商品がありません",
  ];
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const body = await page.locator("body").innerText();
    if (markers.some((m) => body.includes(m))) return true;
    await page.waitForTimeout(250);
  }
  return false;
}

async function runCase(page, name, fn) {
  try {
    const detail = await fn();
    return { name, ok: true, detail };
  } catch (err) {
    return { name, ok: false, detail: String(err?.message ?? err) };
  }
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const results = [];

  results.push(
    await runCase(page, "nav-ready", async () => {
      await page.goto(withCacheBust(SITE), { waitUntil: "domcontentloaded" });
      const count = await waitForNavLinks(page);
      if (count === 0) throw new Error("desktop nav links never appeared");
      return `links=${count}`;
    })
  );

  results.push(
    await runCase(page, "home-to-empty-collection", async () => {
      await page.goto(withCacheBust(SITE), { waitUntil: "domcontentloaded" });
      await waitForNavLinks(page);
      await clickNavHref(page, `/collections/${EMPTY_HANDLE}`);
      await page.waitForTimeout(3500);
      const body = await page.locator("body").innerText();
      const emptyMarkers = [
        "该类目暂无商品",
        "No products in this category yet.",
        "このカテゴリには商品がありません",
      ];
      if (!emptyMarkers.some((m) => body.includes(m))) {
        throw new Error("empty category marker not found");
      }
      if (!page.url().includes(EMPTY_HANDLE)) {
        throw new Error(`expected ${EMPTY_HANDLE}, got ${page.url()}`);
      }
      return page.url();
    })
  );

  results.push(
    await runCase(page, "empty-to-other-nav", async () => {
      await page.goto(withCacheBust(`${SITE}/collections/${EMPTY_HANDLE}`), {
        waitUntil: "domcontentloaded",
      });
      await waitForNavLinks(page);
      if (!(await waitForEmptyCategory(page))) {
        throw new Error("empty category marker not found");
      }
      const before = page.url();
      await clickNavHref(page, `/collections/${TARGET_HANDLE}`);
      await page.waitForTimeout(3500);
      if (page.url() === before) {
        throw new Error(`URL unchanged after nav click: ${before}`);
      }
      return `${before} -> ${page.url()}`;
    })
  );

  results.push(
    await runCase(page, "nonempty-collection-nav-control", async () => {
      await page.goto(withCacheBust(`${SITE}/collections/${NONEMPTY_CONTROL}`), {
        waitUntil: "domcontentloaded",
      });
      await waitForNavLinks(page);
      const before = page.url();
      await clickNavHref(page, `/collections/${TARGET_HANDLE}`);
      await page.waitForTimeout(3500);
      if (page.url() === before) {
        throw new Error(`URL unchanged on control: ${before}`);
      }
      return `${before} -> ${page.url()}`;
    })
  );

  await browser.close();

  const passed = results.filter((r) => r.ok).length;
  const payload = {
    site: SITE,
    passed,
    total: results.length,
    ok: passed === results.length,
    results,
  };
  writeFileSync(OUT_JSON, JSON.stringify(payload, null, 2) + "\n", "utf8");

  for (const r of results) {
    console.log(`[${r.ok ? "PASS" : "FAIL"}] ${r.name}${r.detail ? ` — ${r.detail}` : ""}`);
  }
  console.log(`\nReport: ${OUT_JSON} (${passed}/${results.length})`);
  process.exit(payload.ok ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
