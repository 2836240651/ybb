/**
 * Audit live Woo shipping: subtotal < $100 should charge $5, >= $100 free.
 * Usage: node scripts/audit-shipping-threshold.mjs
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

const site = (process.env.SITE_URL || "https://carp-ybb.com").replace(/\/$/, "");
const secrets = JSON.parse(
  fs.readFileSync(path.join(root, "secrets.local.json"), "utf8")
);
const wp = secrets.wordpress;

const LOW_WC_ID = Number(process.env.LOW_WC_ID || 50709);
const HIGH_QTY = Number(process.env.HIGH_QTY || 250);

const report = { site, at: new Date().toISOString(), scenarios: [] };

function minorToUsd(minor, unit = 2) {
  const n = Number(minor);
  if (!Number.isFinite(n)) return null;
  return Math.round((n / 10 ** unit) * 100) / 100;
}

async function addToCartViaBrowser(page, productId, quantity = 1) {
  const url = `${site}/cart/?add-to-cart=${productId}&quantity=${quantity}`;
  await page.goto(url, { waitUntil: "networkidle", timeout: 90000 });
  await page.waitForTimeout(2000);
  const html = await page.content();
  const empty = /cart-empty|Your cart is currently empty|购物车是空的/i.test(html);
  const hasItems = /cart_item|woocommerce-cart-form__contents/.test(html) && !empty;
  return { url: page.url(), empty, hasItems };
}

async function readCartFromBrowser(page) {
  if (!page.url().includes("/cart")) {
    await page.goto(`${site}/cart/`, {
      waitUntil: "domcontentloaded",
      timeout: 90000,
    });
  }
  const html = await page.content();
  const subtotalMatch = html.match(
    /class="[^"]*cart-subtotal[^"]*"[\s\S]*?<span[^>]*class="[^"]*woocommerce-Price-amount[^"]*"[^>]*>[\s\S]*?<\/span>/i
  );
  const subtotalText = subtotalMatch
    ? subtotalMatch[0].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
    : "";
  const totalMatch = html.match(
    /class="[^"]*order-total[^"]*"[\s\S]*?<span[^>]*class="[^"]*woocommerce-Price-amount[^"]*"[^>]*>[\s\S]*?<\/span>/i
  );
  const totalText = totalMatch
    ? totalMatch[0].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
    : "";
  const shippingMatch = html.match(
    /class="[^"]*shipping[^"]*"[\s\S]*?<td[^>]*data-title="Shipping"[\s\S]*?<\/td>/i
  );
  const shippingText = shippingMatch
    ? shippingMatch[0].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
    : "";
  const empty = /cart-empty|Your cart is currently empty|购物车是空的/i.test(html);
  const itemCount = (html.match(/cart_item/g) || []).length;
  return { empty, itemCount, subtotalText, shippingText, totalText };
}

async function clearCartViaBrowser(page) {
  await page.goto(`${site}/cart/`, { waitUntil: "domcontentloaded", timeout: 90000 });
  while (true) {
    const remove = page.locator("a.remove, .product-remove a").first();
    if (!(await remove.count())) break;
    await remove.click();
    await page.waitForTimeout(800);
  }
}

async function auditCheckout(page, label) {
  await page.goto(`${site}/checkout/`, {
    waitUntil: "domcontentloaded",
    timeout: 90000,
  });

  const fill = async (sel, val) => {
    const el = page.locator(sel);
    if ((await el.count()) && !(await el.inputValue())) await el.fill(val);
  };

  await fill("#billing_first_name", "Test");
  await fill("#billing_last_name", "Buyer");
  await fill("#billing_address_1", "123 Main St");
  await fill("#billing_city", "New York");
  await fill("#billing_postcode", "10001");
  await fill("#billing_phone", "12125550123");
  await fill("#billing_email", wp.email || "test@example.com");
  if (await page.locator("#billing_country").count()) {
    await page.locator("#billing_country").selectOption("US");
  }

  await page.waitForTimeout(3000);
  const html = await page.content();

  const shippingRows = [
    ...html.matchAll(/<tr[^>]*class="[^"]*shipping[^"]*"[\s\S]*?<\/tr>/gi),
  ].map((m) => m[0].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());

  const totalRow = (
    html.match(/<tr[^>]*class="[^"]*order-total[^"]*"[\s\S]*?<\/tr>/i) || [""]
  )[0]
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const shippingMethods = [
    ...html.matchAll(/<input[^>]*name="shipping_method[^"]*"[^>]*>/gi),
  ].map((m) => m[0]);

  return {
    label,
    url: page.url(),
    redirectedToCart: page.url().includes("/cart"),
    shippingRows,
    totalRow,
    shippingMethods,
  };
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();

// Scenario A: low subtotal
await clearCartViaBrowser(page);
const addLow = await addToCartViaBrowser(page, LOW_WC_ID, 1);
const cartLow = await readCartFromBrowser(page);
const checkoutLow = await auditCheckout(page, "low-subtotal");

report.scenarios.push({
  name: "subtotal-under-100",
  addItem: addLow,
  cart: {
    ...cartLow,
  },
  checkout: checkoutLow,
});

// Scenario B: high subtotal
await clearCartViaBrowser(page);
const addHigh = await addToCartViaBrowser(page, LOW_WC_ID, HIGH_QTY);
const cartHigh = await readCartFromBrowser(page);
const checkoutHigh = await auditCheckout(page, "high-subtotal");

report.scenarios.push({
  name: "subtotal-over-100",
  addItem: addHigh,
  cart: {
    ...cartHigh,
  },
  checkout: checkoutHigh,
});

const outPath = path.join(root, "reports", "shipping-audit-live.json");
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));

await browser.close();
