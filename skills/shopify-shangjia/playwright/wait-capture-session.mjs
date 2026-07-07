/**
 * 连接已打开的 Chrome（npm run open-chrome），等待用户手动完成登录/验证后保存 shopify-auth.json
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { chromium } from "playwright";
import { loadConfig } from "./lib/config.mjs";
import { AUTH_FILE, CDP_PORT } from "./lib/browser.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cfg = loadConfig();
const store = cfg.store;
const targetRe = new RegExp(`admin\\.shopify\\.com/store/${store}`, "i");
const maxWaitMs = Number(process.env.CAPTURE_WAIT_MS || 15 * 60 * 1000);
const pollMs = 3000;

console.log("等待你在 Chrome 中完成 Shopify 登录与验证…");
console.log(`目标店铺: https://admin.shopify.com/store/${store}`);
console.log(`最长等待: ${maxWaitMs / 60000} 分钟`);
console.log("登录成功后脚本会自动保存:", AUTH_FILE);

let browser;
try {
  browser = await chromium.connectOverCDP(`http://127.0.0.1:${CDP_PORT}`);
} catch {
  console.error("无法连接 Chrome。请先运行: npm run open-chrome");
  process.exit(1);
}

const context = browser.contexts()[0];
if (!context) {
  console.error("CDP 已连接但未找到浏览器上下文");
  process.exit(1);
}

let page =
  context.pages().find((p) => p.url().includes("shopify.com") && !p.url().includes("about:blank")) ??
  (await context.newPage());

const loginUrl = `https://admin.shopify.com/store/${store}`;
if (!page.url().includes("shopify.com")) {
  await page.goto(loginUrl, { waitUntil: "domcontentloaded", timeout: 120000 }).catch(() => {});
}

const started = Date.now();
let saved = false;

while (Date.now() - started < maxWaitMs) {
  for (const p of context.pages()) {
    const url = p.url();
    if (targetRe.test(url) && !url.includes("accounts.shopify.com")) {
      await p.bringToFront().catch(() => {});
      await context.storageState({ path: AUTH_FILE });
      saved = true;
      console.log("\n✓ 登录态已保存");
      console.log("  页面:", url);
      console.log("  文件:", AUTH_FILE);
      break;
    }
  }
  if (saved) break;

  const elapsed = Math.floor((Date.now() - started) / 1000);
  if (elapsed > 0 && elapsed % 15 === 0) {
    const cur = page.url();
    console.log(`  …仍在等待 (${elapsed}s) 当前: ${cur.slice(0, 100)}`);
  }
  await new Promise((r) => setTimeout(r, pollMs));
}

await browser.close().catch(() => {});

if (!saved) {
  console.error("\n超时：未检测到已进入店铺后台，请确认已登录后重跑: node wait-capture-session.mjs");
  process.exit(1);
}
