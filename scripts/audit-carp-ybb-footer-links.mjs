import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const nav = JSON.parse(readFileSync(join(root, "lib/data/navigation.json"), "utf8"));
const base = "https://carp-ybb.com";

const links = [];
for (const section of ["quickLinks", "information", "policies"]) {
  links.push(...nav.footer[section].map((l) => ({ ...l, section })));
}

const seen = new Set();
const results = [];

for (const item of links) {
  if (seen.has(item.href)) continue;
  seen.add(item.href);

  const url = `${base}${item.href}`;
  const row = { href: item.href, label: item.label, section: item.section, url };

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "ybb-footer-audit/1.0", "Cache-Control": "no-cache" },
      signal: AbortSignal.timeout(45000),
    });
    row.status = res.status;
    const html = await res.text();
    row.htmlLength = html.length;

    const h1 = html.match(/<h1[^>]*>([^<]{1,120})/i);
    row.h1 = h1 ? h1[1].replace(/\s+/g, " ").trim() : null;

    const productCards = (html.match(/product-card/gi) || []).length;
    row.productCards = productCards;

    const noProducts = /no products found|0 products|no products match/i.test(html);
    row.noProducts = noProducts;

    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    row.textLength = text.length;
    row.textSample = text.slice(0, 200);

    const issues = [];
    if (res.status !== 200) issues.push(`HTTP_${res.status}`);
    if (item.href.startsWith("/collections/") && (noProducts || productCards === 0)) {
      issues.push("EMPTY_COLLECTION");
    }
    if (item.href.startsWith("/pages/") && text.length < 500) issues.push("SPARSE_PAGE");
    if (item.href.startsWith("/blogs/") && text.length < 400) issues.push("SPARSE_BLOG");
    row.issues = issues;
  } catch (err) {
    row.error = String(err);
    row.issues = ["FETCH_FAIL"];
  }

  results.push(row);
  const flag = row.issues?.length ? row.issues.join(",") : "ok";
  console.log(`${row.href.padEnd(36)} ${flag}`);
}

const out = join(root, "scripts/carp-ybb-footer-audit.json");
writeFileSync(out, JSON.stringify({ capturedAt: new Date().toISOString(), results }, null, 2));
console.log(`\nWrote ${out}`);
