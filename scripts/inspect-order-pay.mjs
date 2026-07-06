/**
 * Inspect order-pay page Airwallex redirect globals.
 */
const orderId = process.argv[2] || "52180";
const url = `https://carp-ybb.com/checkout/order-pay/${orderId}/`;
const res = await fetch(url);
const html = await res.text();

console.log("url", url, "status", res.status);
console.log("flatShell", /ybb-checkout-page/.test(html));
console.log("pay_for_order", /pay_for_order/.test(html));

for (const key of [
  "awxRedirectElData",
  "awxCommonData",
  "awxCheckoutSettings",
  "wc_checkout_params",
  "wc_airwallex_params",
]) {
  const m = html.match(new RegExp(`${key}\\s*=\\s*(\\{[\\s\\S]{0,4000}?\\});`));
  if (m) {
    try {
      const parsed = JSON.parse(m[1]);
      console.log("\n===", key, "===");
      console.log(JSON.stringify(parsed, null, 2).slice(0, 2500));
    } catch {
      console.log("\n===", key, "(raw) ===");
      console.log(m[1].slice(0, 1200));
    }
  }
}

const airwallexUrls = [
  ...new Set(
    [...html.matchAll(/https?:\/\/[^"'\\s]*airwallex[^"'\\s]*/gi)].map((m) => m[0])
  ),
];
console.log("\nairwallex URLs in HTML:", airwallexUrls.slice(0, 10));
