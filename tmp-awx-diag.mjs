const urls = [
  "https://carp-ybb.com/checkout/",
  "https://carp-ybb.com/cart/",
];

for (const u of urls) {
  const r = await fetch(u, { redirect: "manual" });
  const t = await r.text();
  console.log("\n===", u, r.status, r.headers.get("location") || "");
  const pm = [...t.matchAll(/value="(airwallex[^"]*)"/gi)].map((m) => m[1]);
  console.log("payment gateways", [...new Set(pm)]);
  const scripts = [...t.matchAll(/<script[^>]+src="([^"]+)"/gi)]
    .map((m) => m[1])
    .filter((s) => /airwallex|awx/i.test(s));
  console.log("awx scripts", scripts.length, scripts.slice(0, 5));
  for (const key of [
    "awxCheckoutSettings",
    "awxCommonData",
    "awxRedirectElData",
    "wc_airwallex_params",
  ]) {
    const m = t.match(new RegExp(`${key}[\\s\\S]{0,500}`));
    if (m) console.log(key, m[0].slice(0, 300).replace(/\s+/g, " "));
  }
  const err = [...t.matchAll(/Airwallex[^<]{0,80}/gi)].map((m) => m[0]);
  if (err.length) console.log("err text", err);
}
