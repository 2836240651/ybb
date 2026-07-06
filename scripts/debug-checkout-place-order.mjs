/**
 * Full-chain checkout debug: sync cart → checkout → place order → capture redirect.
 * Usage: node scripts/debug-checkout-place-order.mjs
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
const secrets = JSON.parse(fs.readFileSync(path.join(root, "secrets.local.json"), "utf8"));
const wp = secrets.wordpress;

const TEST_WC_ID = Number(process.env.TEST_WC_ID || 50709);
const report = {
  site,
  at: new Date().toISOString(),
  steps: [],
};

function log(step, data) {
  report.steps.push({ step, ...data });
  console.log(step, typeof data === "object" ? JSON.stringify(data, null, 2) : data);
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();

page.on("response", async (resp) => {
  const url = resp.url();
  if (
    /checkout|wc-ajax|airwallex|order-pay|order-received|wp-json\/wc/i.test(url) &&
    ["POST", "GET"].includes(resp.request().method())
  ) {
    const entry = {
      method: resp.request().method(),
      url,
      status: resp.status(),
      location: resp.headers()["location"] || null,
    };
    if (resp.status() >= 400 || entry.location) {
      log("network", entry);
    }
  }
});

// Login (best effort — guest checkout also works if enabled)
await page.goto(`${wp.siteUrl}/wp-login.php`, { waitUntil: "domcontentloaded" });
if (!page.url().includes("wp-admin")) {
  await page.locator("#user_login").fill(wp.email);
  await page.locator("#user_pass").fill(wp.password);
  await page.locator("#wp-submit").click();
  await page.waitForTimeout(5000);
}
log("login", {
  url: page.url(),
  loggedIn: page.url().includes("wp-admin") || (await page.context().cookies()).some((c) => c.name.startsWith("wordpress_logged_in")),
});

// Establish Woo session + Store API nonce
await page.goto(`${site}/cart/`, { waitUntil: "domcontentloaded", timeout: 60000 });
const cartProbe = await page.request.get(`${site}/wp-json/wc/store/v1/cart`);
const nonce = cartProbe.headers()["x-wc-store-api-nonce"];
log("store-nonce", { status: cartProbe.status(), hasNonce: !!nonce });

const addRes = await page.request.post(`${site}/wp-json/wc/store/v1/cart/add-item`, {
  headers: nonce ? { Nonce: nonce, "X-WC-Store-API-Nonce": nonce } : {},
  data: { id: TEST_WC_ID, quantity: 1 },
});
log("store-add-item", { status: addRes.status(), body: (await addRes.text()).slice(0, 500) });

await page.goto(`${site}/cart/`, { waitUntil: "domcontentloaded", timeout: 60000 });
const cartHtml = await page.content();
log("cart-get", {
  url: page.url(),
  hasItems: /cart_item|woocommerce-cart-form__contents/.test(cartHtml) && !/cart-empty/.test(cartHtml),
  empty: /cart-empty|Your cart is currently empty|购物车是空的/i.test(cartHtml),
});

await page.goto(`${site}/checkout/`, { waitUntil: "domcontentloaded", timeout: 60000 });
const checkoutHtml = await page.content();
log("checkout-get", {
  url: page.url(),
  hasFlatShell: /ybb-checkout-page/.test(checkoutHtml),
  paymentMethods: [
    ...new Set([...checkoutHtml.matchAll(/value="(airwallex[^"]*)"/gi)].map((m) => m[1])),
  ],
  hasPlaceOrder: /id="place_order"/.test(checkoutHtml),
  notices: [...checkoutHtml.matchAll(/woocommerce-error[^>]*>([\s\S]*?)<\/li/gi)].map((m) =>
    m[1].replace(/<[^>]+>/g, "").trim()
  ),
});

if (page.url().includes("/cart")) {
  log("abort", { reason: "redirected to cart — empty session" });
  await browser.close();
  process.exit(1);
}

// Fill minimal billing if empty
const fillIfEmpty = async (sel, val) => {
  const el = page.locator(sel);
  if ((await el.count()) && !(await el.inputValue())) await el.fill(val);
};
await fillIfEmpty("#billing_first_name", "Test");
await fillIfEmpty("#billing_last_name", "Buyer");
await fillIfEmpty("#billing_address_1", "11 Test St");
await fillIfEmpty("#billing_city", "Hong Kong");
await fillIfEmpty("#billing_phone", "85212345678");
await fillIfEmpty("#billing_email", wp.email || "test@example.com");

// Prefer airwallex_main if present
const mainPm = page.locator('input[name="payment_method"][value="airwallex_main"]');
const cardPm = page.locator('input[name="payment_method"][value="airwallex_card"]');
if (await mainPm.count()) {
  await mainPm.check({ force: true });
  log("payment", { selected: "airwallex_main" });
} else if (await cardPm.count()) {
  await cardPm.check({ force: true });
  log("payment", { selected: "airwallex_card" });
}

const placeOrder = page.locator("#place_order");
if (!(await placeOrder.count())) {
  log("abort", { reason: "no #place_order" });
  await browser.close();
  process.exit(1);
}

await Promise.all([
  page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 90000 }).catch(() => null),
  placeOrder.click(),
]);

await page.waitForTimeout(3000);
const afterHtml = await page.content();
log("after-place-order", {
  url: page.url(),
  title: await page.title(),
  isHome:
    page.url() === `${site}/` ||
    page.url() === `${site}/index.html` ||
    /\/index\.html$/.test(page.url()),
  hasOrderPay: /order-pay/.test(page.url()),
  hasOrderReceived: /order-received/.test(page.url()),
  hasAirwallexHost: /airwallex|checkout\.airwallex/i.test(page.url()),
  errors: [...afterHtml.matchAll(/woocommerce-error[^>]*>([\s\S]*?)<\/li/gi)].map((m) =>
    m[1].replace(/<[^>]+>/g, "").trim()
  ),
  bodySnippet: afterHtml.replace(/\s+/g, " ").slice(0, 800),
});

const outPath = path.join(root, "reports", "checkout-place-order-debug.json");
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
console.log("wrote", outPath);

await browser.close();
