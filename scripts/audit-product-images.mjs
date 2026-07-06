import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const CSV_PATH = join(__dirname, "../../assets-manifest.csv");
const PRODUCTS_PATH = join(ROOT, "lib/data/products.json");
const PUBLIC_PRODUCTS = join(ROOT, "public/products");

function parseArgs() {
  const args = process.argv.slice(2);
  const siteIdx = args.indexOf("--site");
  const outIdx = args.indexOf("--out");
  return {
    site: siteIdx >= 0 ? args[siteIdx + 1] : "https://carp-ybb.com",
    out:
      outIdx >= 0
        ? args[outIdx + 1]
        : join(ROOT, "deploy/product-import/image-audit-report.json"),
  };
}

function parseCsv(text) {
  const lines = text.trim().split("\n");
  if (!lines.length) return [];
  const headers = lines[0].split(",").map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const cols = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') inQuotes = !inQuotes;
      else if (ch === "," && !inQuotes) {
        cols.push(cur);
        cur = "";
      } else {
        cur += ch;
      }
    }
    cols.push(cur);
    const row = {};
    headers.forEach((h, i) => {
      row[h] = (cols[i] ?? "").trim();
    });
    return row;
  });
}

async function fetchAllStoreProducts(site) {
  const all = [];
  let page = 1;
  for (;;) {
    const url = `${site}/wp-json/wc/store/v1/products?per_page=100&page=${page}`;
    const res = await fetch(url);
    if (!res.ok) {
      if (res.status === 404 && page === 1) {
        return { products: [], skipped: true, reason: `store API unavailable: ${url}` };
      }
      throw new Error(`fetch products failed: ${res.status} ${url}`);
    }
    const chunk = await res.json();
    if (!Array.isArray(chunk) || chunk.length === 0) break;
    all.push(...chunk);
    if (chunk.length < 100) break;
    page += 1;
  }
  return { products: all, skipped: false, reason: null };
}

async function main() {
  const { site, out } = parseArgs();
  const csvRows = parseCsv(readFileSync(CSV_PATH, "utf8"));
  const products = JSON.parse(readFileSync(PRODUCTS_PATH, "utf8"));
  const wpFetch = await fetchAllStoreProducts(site);
  const storeProducts = wpFetch.products;
  const wpBySlug = new Map(storeProducts.map((p) => [p.slug, p]));
  const productByHandle = new Map(products.map((p) => [p.handle, p]));

  const missingLocal = [];
  const missingExport = [];
  const missingWpBinding = [];

  for (const row of csvRows) {
    const handle = row.handle;
    const sourcePath = row.primary_image || "";
    if (!handle) continue;

    if (!sourcePath || !existsSync(sourcePath)) {
      missingLocal.push({ handle, sourcePath: sourcePath || null });
    }

    const exportedPath = join(PUBLIC_PRODUCTS, handle, "master.webp");
    if (!existsSync(exportedPath)) {
      missingExport.push({ handle, expectedPath: exportedPath });
    }

    const wpProduct = wpBySlug.get(handle);
    if (
      !wpFetch.skipped &&
      (!wpProduct || !Array.isArray(wpProduct.images) || wpProduct.images.length === 0)
    ) {
      missingWpBinding.push({
        handle,
        sku: productByHandle.get(handle)?.sku || null,
        wcId: wpProduct?.id || productByHandle.get(handle)?.wcId || null,
      });
    }
  }

  const report = {
    generatedAt: new Date().toISOString(),
    site,
    totals: {
      csvRows: csvRows.length,
      productsJson: products.length,
      wpProducts: storeProducts.length,
      missingLocal: missingLocal.length,
      missingExport: missingExport.length,
      missingWpBinding: missingWpBinding.length,
    },
    wpBindingCheck: {
      skipped: wpFetch.skipped,
      reason: wpFetch.reason,
    },
    missingLocal,
    missingExport,
    missingWpBinding,
  };

  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(report, null, 2) + "\n", "utf8");
  console.log(`[audit-product-images] wrote ${out}`);
  console.log(
    `[audit-product-images] missing-local=${missingLocal.length}, missing-export=${missingExport.length}, missing-wp-binding=${missingWpBinding.length}`
  );
}

main().catch((err) => {
  console.error("[audit-product-images] failed:", err?.message || err);
  process.exit(1);
});
