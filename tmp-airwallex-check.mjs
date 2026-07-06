import fs from "node:fs";

const html = await (await fetch("https://carp-ybb.com/checkout/")).text();
fs.writeFileSync("tmp-checkout.html", html, "utf8");

const scriptSrc = [...html.matchAll(/<script[^>]+src="([^"]+)"/gi)].map((m) => m[1]);
const awx = scriptSrc.filter((s) => /airwallex|awx/i.test(s));
console.log("airwallex script tags", awx.length);
for (const s of awx) {
  const r = await fetch(s.startsWith("http") ? s : `https://carp-ybb.com${s}`);
  console.log(r.status, s.slice(0, 120));
}

const inline = [...html.matchAll(/<script[^>]*>([\s\S]*?airwallex[\s\S]*?)<\/script>/gi)]
  .map((m) => m[1].slice(0, 300));
console.log("inline airwallex blocks", inline.length);
for (const block of inline.slice(0, 3)) console.log(block.replace(/\s+/g, " "));

const vars = [
  "awxCheckoutSettings",
  "airwallexCheckoutSettings",
  "awxCommonData",
  "wc_airwallex",
];
for (const v of vars) {
  const m = html.match(new RegExp(`${v}[\\s\\S]{0,400}`));
  if (m) console.log("\n", m[0].slice(0, 400));
}

const pm = [...html.matchAll(/value="(airwallex[^"]*)"/gi)].map((m) => m[1]);
console.log("payment values", [...new Set(pm)]);
