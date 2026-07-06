const urls = [
  "https://carp-ybb.com/wc-api/airwallex_main?order_id=52180",
  "https://carp-ybb.com/airwallex-checkout/?order_id=52180",
];

for (const u of urls) {
  const r = await fetch(u, { redirect: "manual" });
  const t = await r.text();
  console.log(u);
  console.log("  status", r.status, "location", r.headers.get("location"));
  console.log("  title", (t.match(/<title>([^<]+)/) || [])[1]);
  console.log("  isStaticHome", /Wholesale Terminal Tackle Factory/.test(t));
  console.log("  hasAwxDropIn", /drop-in|paymentIntent|checkout\.airwallex/i.test(t));
}
