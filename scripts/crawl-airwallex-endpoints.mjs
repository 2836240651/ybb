/**
 * Crawl carp-ybb checkout/cart HTML + WC Store API for Airwallex-related endpoints.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const site = process.env.SITE_URL || "https://carp-ybb.com";
const outDir = path.join(__dirname, "..", "reports");
fs.mkdirSync(outDir, { recursive: true });

const pages = [`${site}/checkout/`, `${site}/cart/`];

const report = { site, fetchedAt: new Date().toISOString(), pages: {} };

for (const url of pages) {
  const res = await fetch(url, { redirect: "manual" });
  const html = await res.text();
  const scripts = [...html.matchAll(/<script[^>]+src="([^"]+)"/gi)]
    .map((m) => m[1])
    .filter((s) => /airwallex|awx/i.test(s));
  const gateways = [
    ...new Set([...html.matchAll(/value="(airwallex[^"]*)"/gi)].map((m) => m[1])),
  ];
  const globals = {};
  for (const key of [
    "awxCheckoutSettings",
    "awxCommonData",
    "awxRedirectElData",
    "wc_airwallex_params",
  ]) {
    const m = html.match(new RegExp(`${key}\\s*=\\s*(\\{[\\s\\S]{0,2000}?\\});`));
    if (m) {
      try {
        globals[key] = JSON.parse(m[1]);
      } catch {
        globals[key] = m[1].slice(0, 500);
      }
    }
  }
  const apiUrls = [
    ...new Set(
      [...html.matchAll(/https?:\/\/[^"'\\s]*airwallex[^"'\\s]*/gi)].map((m) => m[0])
    ),
  ];
  report.pages[url] = {
    status: res.status,
    redirect: res.headers.get("location"),
    gateways,
    scripts,
    globals,
    apiUrls,
    errors: [...html.matchAll(/Airwallex[^<]{0,120}/gi)].map((m) => m[0]),
  };
}

// WC ajax endpoints referenced by checkout JS
report.wcAjax = {
  checkout: `${site}/?wc-ajax=checkout`,
  updateOrderReview: `${site}/?wc-ajax=update_order_review`,
};
report.storeApi = {
  cart: `${site}/wp-json/wc/store/v1/cart`,
  checkout: `${site}/wp-json/wc/store/v1/checkout`,
};
report.airwallexServerApi = {
  note: "Called by Woo plugin server-side only (not in HTML)",
  createPaymentIntent: "POST {base}/api/v1/pa/payment_intents/create",
};
report.diagnosis = {
  latestErrorLog:
    "wp-content/uploads/wc-logs/airwallex-error-2026-06-26_e1bfae0c2394926c1e364062f6698787.log",
  errorCode: "configuration_error",
  message:
    "Invalid request against merchant configuration. Please contact your account manager.",
  traceIds: [
    "f5673161fe514a8abbe3bc4239d7a481",
    "f15f1738382a46b7ae2186cb38dd05e2",
  ],
  failedOrderId: 52104,
  gateway: "airwallex_main",
  report: "reports/airwallex-payment-error-diagnosis.md",
};

const outPath = path.join(outDir, "airwallex-endpoints-crawl.json");
fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
console.log("wrote", outPath);
console.log(JSON.stringify(report, null, 2));
