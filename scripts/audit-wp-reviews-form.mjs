/**
 * Click "Add Comment" on product 51480 and dump review form fields.
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

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

async function solveLoginCaptcha() {
  const text = await page.locator("body").innerText();
  const match = text.match(/(\d+)\s*\+\s*(\d+)\s*=/);
  if (!match) return;
  const answer = String(Number(match[1]) + Number(match[2]));
  const input = page.locator('input[type="number"]').first();
  if (await input.count()) await input.fill(answer);
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
}

await login();
await page.goto(`${wp.adminUrl}/post.php?post=51480&action=edit`, {
  waitUntil: "domcontentloaded",
  timeout: 60000,
});
await page.waitForTimeout(2500);

await page.evaluate(() => {
  const panel = document.querySelector("#woocommerce-product-data");
  if (panel?.classList.contains("closed")) {
    panel.querySelector(".handlediv")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  }
  const tab = document.querySelector('a[href="#advanced_product_data"]');
  tab?.click();
});
await page.waitForTimeout(800);
const reviewsChecked = await page.locator("#comment_status").isChecked().catch(() => null);
console.log("Product data > Advanced > Enable reviews checked:", reviewsChecked);

// Reviews metabox
const reviewsPanel = page.locator("#woocommerce-reviews h2, #commentsdiv h2").first();
console.log("Reviews panel visible:", await reviewsPanel.count() > 0);

const addComment = page.getByRole("button", { name: /^Add Comment$/i });
console.log("Add Comment button:", await addComment.count());
await page.evaluate(() => {
  const btn = [...document.querySelectorAll("button")].find((b) =>
    /add comment/i.test(b.textContent || "")
  );
  btn?.click();
});
await page.waitForTimeout(1200);

const labels = await page.locator("label").allInnerTexts();
const reviewLabels = labels.filter((t) => /rating|review|comment|author|email|star/i.test(t));
console.log("Form labels:", reviewLabels.join(" | "));

const selects = await page.locator("select").evaluateAll((els) =>
  els.map((el) => ({
    id: el.id,
    name: el.name,
    options: [...el.options].map((o) => o.text),
  }))
);
console.log("Select fields:", JSON.stringify(selects.filter((s) => /rating|comment/i.test(JSON.stringify(s))), null, 2));

await page.screenshot({
  path: path.join(outDir, "product-edit-51480-add-comment.png"),
  fullPage: true,
});

await browser.close();
