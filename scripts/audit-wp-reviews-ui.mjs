/**
 * Explore WooCommerce product reviews UI in wp-admin.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const require = createRequire(import.meta.url);
const { chromium } = require(
  path.join("D:", "dev", "独立站上架", "wordpress", "node_modules", "playwright")
);

const secrets = JSON.parse(
  fs.readFileSync(path.join(root, "secrets.local.json"), "utf8")
);
const wp = secrets.wordpress;
const outDir = path.join(root, "scripts", ".audit-output");
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

async function solveLoginCaptcha() {
  const label = await page.locator("label[for], .login label").filter({ hasText: /=/ }).first();
  const text = (await label.innerText().catch(() => "")) || "";
  const match = text.match(/(\d+)\s*\+\s*(\d+)\s*=/);
  if (!match) return;
  const answer = String(Number(match[1]) + Number(match[2]));
  const input = page.locator('input[name*="captcha"], input[type="number"], #jetpack_protect_answer').first();
  if (await input.count()) {
    await input.fill(answer);
  }
}

async function login() {
  await page.goto(`${wp.siteUrl}/wp-login.php`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  if (page.url().includes("wp-admin")) return;
  await page.locator("#user_login").fill(wp.email);
  await page.locator("#user_pass").fill(wp.password);
  await solveLoginCaptcha();
  await page.locator("#wp-submit").click();
  await page.waitForTimeout(4000);
  if (!page.url().includes("wp-admin")) {
    const body = await page.locator("body").innerText();
    throw new Error(`login failed: ${page.url()}\n${body.slice(0, 400)}`);
  }
}

await login();
console.log("logged in");

const targets = [
  {
    name: "product-reviews-list",
    url: `${wp.adminUrl}/edit.php?post_type=product&page=product-reviews`,
  },
  {
    name: "product-edit-51480",
    url: `${wp.adminUrl}/post.php?post=51480&action=edit`,
  },
  {
    name: "wc-settings-products",
    url: `${wp.adminUrl}/admin.php?page=wc-settings&tab=products`,
  },
];

for (const target of targets) {
  await page.goto(target.url, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(2500);
  const shot = path.join(outDir, `${target.name}.png`);
  await page.screenshot({ path: shot, fullPage: true });
  console.log(`\n=== ${target.name} ===`);
  console.log("url:", page.url());

  const buttons = await page.locator("a, button").allInnerTexts();
  const interesting = buttons
    .map((t) => t.trim())
    .filter((t) => t && /review|comment|add|enable|评价|评论/i.test(t))
    .slice(0, 30);
  console.log("interesting controls:", interesting.join(" | ") || "(none)");

  const body = await page.locator("body").innerText();
  const lines = body
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && /review|comment|enable|rating|评价|评论|星级/i.test(l))
    .slice(0, 25);
  for (const line of lines) console.log("-", line);
}

await browser.close();
console.log("\nscreenshots:", outDir);
