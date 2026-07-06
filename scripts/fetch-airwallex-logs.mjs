/**
 * Fetch Airwallex WC logs via authenticated wp-admin (Playwright storage from CDP or login).
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

const logFiles = [
  "airwallex-error-2026-06-25_e1bfae0c2394926c1e364062f6698787",
  "airwallex-debug-2026-06-25_e1bfae0c2394926c1e364062f6698787",
  "place-order-debug-9e1ce386-2026-06-25",
];

let browser;
try {
  browser = await chromium.connectOverCDP("http://127.0.0.1:9224");
  console.log("connected CDP 9224");
} catch {
  browser = await chromium.launch({ headless: true });
  console.log("launched headless browser");
}

const context =
  browser.contexts()[0] ||
  (await browser.newContext({ ignoreHTTPSErrors: true }));
let page = context.pages().find((p) => p.url().includes("carp-ybb"));
if (!page) {
  page = await context.newPage();
  await page.goto(`${wp.siteUrl}/wp-login.php`, { waitUntil: "domcontentloaded" });
  if (!page.url().includes("wp-admin")) {
    await page.locator("#user_login").fill(wp.email);
    await page.locator("#user_pass").fill(wp.password);
    await page.locator("#wp-submit").click();
    await page.waitForTimeout(5000);
  }
}

for (const logFile of logFiles) {
  const viewUrl = `${wp.adminUrl}/admin.php?page=wc-status&tab=logs&log_file=${encodeURIComponent(logFile)}`;
  await page.goto(viewUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(1500);
  const content = await page.evaluate(() => {
    const pre = document.querySelector("pre");
    const ta = document.querySelector("textarea");
    const body = document.body.innerText
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    const interesting = body.filter((l) =>
      /error|failed|payment|intent|airwallex|invalid|unauthorized|onboard|403|401/i.test(l)
    );
    return {
      pre: pre?.innerText || ta?.value || null,
      interesting: interesting.slice(0, 80),
      title: document.title,
    };
  });
  console.log("\n==========", logFile, "==========");
  if (content.pre) {
    console.log(content.pre.slice(0, 4000));
  } else {
    for (const line of content.interesting) console.log(line);
  }
}

// Also read payments settings snippets
const payUrl = `${wp.adminUrl}/admin.php?page=wc-settings&tab=checkout`;
await page.goto(payUrl, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2000);
const payText = await page.locator("body").innerText();
const payLines = payText
  .split("\n")
  .map((l) => l.trim())
  .filter(
    (l) =>
      l &&
      /airwallex|完成设置|onboard|connect|api|启用|禁用|test|live|sandbox/i.test(l)
  );
console.log("\n========== PAYMENTS PAGE ==========");
for (const l of payLines.slice(0, 50)) console.log(l);

await browser.close();
