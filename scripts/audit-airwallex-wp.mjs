/**
 * Audit Airwallex WooCommerce gateway settings via wp-admin (Playwright).
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

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

async function login() {
  await page.goto(`${wp.siteUrl}/wp-login.php`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);
  if (page.url().includes("wp-admin")) return;
  await page.locator("#user_login").fill(wp.email);
  await page.locator("#user_pass").fill(wp.password);
  await page.locator("#wp-submit").click();
  await page.waitForTimeout(5000);
  if (!page.url().includes("wp-admin")) {
    throw new Error(`login failed: ${page.url()}`);
  }
}

await login();
console.log("logged in");

const targets = [
  `${wp.adminUrl}/admin.php?page=wc-settings&tab=checkout`,
  `${wp.adminUrl}/admin.php?page=wc-settings&tab=checkout&section=airwallex_main`,
  `${wp.adminUrl}/admin.php?page=wc-settings&tab=checkout&section=airwallex_card`,
  `${wp.adminUrl}/admin.php?page=airwallex-online-payments-gateway`,
];

for (const url of targets) {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(2000);
  const text = await page.locator("body").innerText();
  const snippet = text
    .split("\n")
    .map((l) => l.trim())
    .filter(
      (l) =>
        l &&
        /airwallex|awx|onboard|api|client|secret|test|live|connected|error|payment/i.test(
          l
        )
    )
    .slice(0, 40);
  console.log("\n===", url, "===");
  for (const line of snippet) console.log(line);
}

await browser.close();
