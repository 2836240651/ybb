/**
 * Print enabled Airwallex gateway IDs from checkout HTML (needs items in Woo cart).
 * Usage: node scripts/audit-checkout-gateways.mjs
 */
const site = process.env.SITE_URL || "https://carp-ybb.com";

const checkoutRes = await fetch(`${site}/checkout/`, { redirect: "manual" });
const checkoutHtml = await checkoutRes.text();

const methods = [
  ...new Set(
    [...checkoutHtml.matchAll(/payment_method_[a-z0-9_]+/gi)].map((m) => m[0])
  ),
];
const values = [
  ...new Set(
    [...checkoutHtml.matchAll(/value="(airwallex[^"]*)"/gi)].map((m) => m[1])
  ),
];

console.log("checkout status:", checkoutRes.status, checkoutRes.headers.get("location") || "");
console.log("payment_method_* classes:", methods.length ? methods : "(none — cart may be empty)");
console.log("gateway values:", values.length ? values : "(none)");

if (methods.includes("payment_method_airwallex_main")) {
  console.log("RESULT: airwallex_main (hosted redirect) present");
} else if (methods.includes("payment_method_airwallex_card")) {
  console.log("RESULT: airwallex_card (embedded card) present");
} else {
  console.log("RESULT: no airwallex gateway in HTML");
}
