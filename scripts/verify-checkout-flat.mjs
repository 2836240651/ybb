/**
 * Verify flat checkout mu-plugin markers on production / local WP checkout page.
 */
const site = process.env.SITE_URL || "https://carp-ybb.com";
const checkoutUrl = `${site.replace(/\/$/, "")}/checkout/`;

const res = await fetch(checkoutUrl, { redirect: "manual" });
const html = await res.text();

const checks = {
  status: res.status,
  redirect: res.headers.get("location"),
  hasFlatShell: /ybb-checkout-page/.test(html),
  hasCheckoutForm: /form[^>]+checkout|class="checkout woocommerce-checkout/.test(html),
  hasPlaceOrder: /id="place_order"|name="woocommerce_checkout_place_order"/.test(html),
  hasFakeAirwallexLink: /\/airwallex-checkout\//.test(html),
  hasFakeLineItems: /Sinker Rig Kit|OEM Sample Kit/.test(html),
  paymentMethods: [
    ...new Set(
      [...html.matchAll(/value="(airwallex[^"]*|awx[^"]*)"/gi)].map((m) => m[1])
    ),
  ],
  awxScripts: [...html.matchAll(/<script[^>]+src="([^"]+)"/gi)]
    .map((m) => m[1])
    .filter((s) => /airwallex|awx/i.test(s)),
};

console.log(JSON.stringify(checks, null, 2));

const failed = [];
if (checks.status >= 400) failed.push(`HTTP ${checks.status}`);
if (checks.hasFakeAirwallexLink) failed.push("fake /airwallex-checkout/ link still present");
if (checks.hasFakeLineItems) failed.push("hardcoded fake line items still present");
if (!checks.hasCheckoutForm) failed.push("missing form.checkout");
if (!checks.hasPlaceOrder) failed.push("missing #place_order");

if (failed.length) {
  console.error("FAIL:", failed.join("; "));
  process.exit(1);
}

console.log("PASS: checkout page has real Woo form (flat shell:", checks.hasFlatShell, ")");
