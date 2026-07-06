#!/usr/bin/env node
/**
 * Fill video module tri-labels in YBB Site Manager, save, capture REST + form POST.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SECRETS = JSON.parse(fs.readFileSync(path.join(ROOT, "secrets.local.json"), "utf8"));
const REPORT = path.join(ROOT, "reports", "video-labels-capture.json");

const LABELS = {
  title: {
    en: "30+ Years of Terminal Tackle Manufacturing",
    zh: "30+ 年终端钓具制造经验",
    ja: "30年以上のターミナルタックル製造",
  },
  body: {
    en: "Tour our production floor — sinkers, rigs, bait cages, and OEM programs built for global brands.",
    zh: "走进生产车间——铅坠、钓组、饵笼，以及面向全球品牌的 OEM 定制生产线。",
    ja: "生産現場をご案内——シンカー、リグ、餌籠、そして世界のブランド向けOEMプログラム。",
  },
  cta: {
    en: "Request a factory visit",
    zh: "预约工厂参观",
    ja: "工場見学を申し込む",
  },
};

const REST_URL =
  "https://carp-ybb.com/index.php?rest_route=/ybb/v1/site-manager/factory-video";

function fieldName(key, locale) {
  return `ybb_site_manager_settings[video][labels][${key}][${locale}]`;
}

async function fetchRest() {
  const res = await fetch(REST_URL, { headers: { Accept: "application/json" } });
  return { status: res.status, body: await res.json() };
}

async function maybeLogin(page, wp) {
  if (!page.url().includes("wp-login.php")) return false;
  await page.fill("#user_login", wp.email);
  await page.fill("#user_pass", wp.password);
  const math = page.locator("#jetpack_protect_answer, input[name='jetpack_protect_num']");
  if ((await math.count()) > 0) {
    throw new Error("Jetpack math captcha on login — complete login manually in headed browser, then re-run.");
  }
  await page.click("#wp-submit");
  await page.waitForLoadState("domcontentloaded");
  return true;
}

async function main() {
  const wp = SECRETS.wordpress;
  const capture = {
    at: new Date().toISOString(),
    restBefore: null,
    restAfter: null,
    savePost: null,
    restAfterSaveFromBrowser: null,
    labelsSubmitted: LABELS,
  };

  capture.restBefore = await fetchRest();

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const network = [];
  page.on("response", async (res) => {
    const url = res.url();
    if (
      url.includes("/site-manager/factory-video") ||
      (url.includes("options.php") && res.request().method() === "POST")
    ) {
      let body = null;
      try {
        const ct = res.headers()["content-type"] || "";
        if (ct.includes("application/json")) body = await res.json();
        else if (url.includes("factory-video")) body = await res.text();
      } catch {
        body = null;
      }
      network.push({
        method: res.request().method(),
        url,
        status: res.status(),
        body,
      });
    }
  });

  await page.goto(`${wp.adminUrl}/admin.php?page=ybb-site-manager&tab=video`, {
    waitUntil: "domcontentloaded",
  });
  await maybeLogin(page, wp);
  if (page.url().includes("wp-login.php")) {
    await browser.close();
    throw new Error("Login failed — still on wp-login.php");
  }
  await page.goto(`${wp.adminUrl}/admin.php?page=ybb-site-manager&tab=video`, {
    waitUntil: "domcontentloaded",
  });

  for (const [key, locales] of Object.entries(LABELS)) {
    for (const [locale, value] of Object.entries(locales)) {
      const sel = `input[name="${fieldName(key, locale)}"]`;
      await page.locator(sel).fill(value);
    }
  }

  await page.getByRole("button", { name: "保存" }).click();
  await page.waitForURL(/settings-updated=true/, { timeout: 30000 });

  await page.waitForTimeout(1500);

  capture.savePost = network.find((n) => n.url.includes("options.php") && n.method === "POST") ?? null;
  capture.restAfterSaveFromBrowser =
    network.filter((n) => n.url.includes("factory-video")).pop() ?? null;

  await browser.close();

  capture.restAfter = await fetchRest();

  fs.mkdirSync(path.dirname(REPORT), { recursive: true });
  fs.writeFileSync(REPORT, JSON.stringify(capture, null, 2) + "\n");
  console.log("Wrote", REPORT);
  console.log("REST before title.zh:", capture.restBefore?.body?.labels?.title?.zh);
  console.log("REST after  title.zh:", capture.restAfter?.body?.labels?.title?.zh);
  console.log("REST after  body.zh:", capture.restAfter?.body?.labels?.body?.zh);
  console.log("REST after  cta.ja:", capture.restAfter?.body?.labels?.cta?.ja);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
