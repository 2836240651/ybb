/**
 * Disable all Airwallex Woo gateways except airwallex_card via wp-admin (CDP).
 * Run while Chrome on carp-ybb wp-admin is on port 9224, or falls back to login.
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

const disableSections = [
  "airwallex_main",
  "airwallex_express_checkout",
  "airwallex_wechat",
  "airwallex_klarna",
  "airwallex_afterpay",
  "airwallex_pos",
  "awx_onboarding_gateway",
];

let browser;
try {
  browser = await chromium.connectOverCDP("http://127.0.0.1:9224");
} catch {
  browser = await chromium.launch({ headless: true });
}

const context = browser.contexts()[0] || (await browser.newContext());
let page = context.pages().find((p) => p.url().includes("carp-ybb"));
if (!page) {
  page = await context.newPage();
  await page.goto(`${wp.siteUrl}/wp-login.php`);
  if (!page.url().includes("wp-admin")) {
    await page.locator("#user_login").fill(wp.email);
    await page.locator("#user_pass").fill(wp.password);
    await page.locator("#wp-submit").click();
    await page.waitForTimeout(4000);
  }
}

async function disableSection(section) {
  const url = `${wp.adminUrl}/admin.php?page=wc-settings&tab=checkout&section=${section}`;
  const resp = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
  if (resp?.status() === 404 || page.url().includes("section=") === false) {
    console.log(section, "SKIP (section not found)");
    return;
  }
  const cb = page.locator(`input[id$="${section}_enabled"], input[name*="${section}_enabled"]`);
  if ((await cb.count()) === 0) {
    console.log(section, "SKIP (no enabled checkbox)");
    return;
  }
  const checked = await cb.isChecked();
  if (!checked) {
    console.log(section, "already disabled");
    return;
  }
  await cb.uncheck({ force: true });
  await page.locator('button[name="save"], input[name="save"]').click();
  await page.waitForTimeout(2000);
  const notice = await page.locator(".updated, .notice-success").first().textContent().catch(() => "");
  console.log(section, "disabled", notice?.trim() || "");
}

for (const section of disableSections) {
  await disableSection(section);
}

// Verify card still enabled
await page.goto(
  `${wp.adminUrl}/admin.php?page=wc-settings&tab=checkout&section=airwallex_card`,
  { waitUntil: "domcontentloaded" }
);
const cardEnabled = await page
  .locator('input[id$="airwallex_card_enabled"]')
  .isChecked()
  .catch(() => false);
console.log("airwallex_card enabled:", cardEnabled);

await browser.close();
