#!/usr/bin/env node
/**
 * Trace HTTP redirects for product URLs (production carp-ybb.com).
 * Usage: node scripts/audit-product-redirects.mjs [handle]
 */
const handle = process.argv[2] || "tz-eldz-012";
const base = "https://carp-ybb.com";
const paths = [
  `/products/${handle}`,
  `/products/${handle}/`,
  `/products/${handle}.html`,
  `/products/${handle}/reviews`,
  `/products/reviews/${handle}`,
];

async function trace(path) {
  const url = `${base}${path}`;
  const chain = [];
  let current = url;
  for (let i = 0; i < 12; i++) {
    const res = await fetch(current, {
      redirect: "manual",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });
    chain.push({ step: i + 1, url: current, status: res.status });
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc) break;
      current = loc.startsWith("http") ? loc : new URL(loc, current).href;
      continue;
    }
    break;
  }
  const loop =
    chain.length > 8 ||
    chain.some((c, idx) => idx > 0 && c.url === chain[idx - 1]?.url);
  return { path, chain, loop };
}

console.log(`[audit-product-redirects] handle=${handle}`);
for (const path of paths) {
  try {
    const result = await trace(path);
    const summary = result.chain.map((c) => `${c.status} ${c.url}`).join(" -> ");
    console.log(`\n${path}`);
    console.log(summary);
    if (result.loop) console.log("  ⚠ possible redirect loop");
  } catch (err) {
    console.log(`\n${path}\n  ERROR ${err.message}`);
  }
}
