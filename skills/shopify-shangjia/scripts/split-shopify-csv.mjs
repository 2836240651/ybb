/**
 * 将 Shopify 产品/库存 CSV 按产品（Handle 首行）拆成多批
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { parseCsvLine, toCsv } from "./lib/csv.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

function arg(name, fallback = "") {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const productsCsv = arg("--csv");
const inventoryCsv = arg("--inventory");
const batchSize = Number(arg("--size", "25"));
const outDir = arg("--out", path.join(ROOT, "output", "shopify", "batches"));

if (!productsCsv || !fs.existsSync(productsCsv)) {
  console.error("用法: node scripts/split-shopify-csv.mjs --csv <products.csv> [--inventory <inventory.csv>]");
  process.exit(1);
}

const invPath =
  inventoryCsv ||
  productsCsv.replace("_products_import.csv", "_inventory_import.csv");

function splitProductsCsv(csvPath) {
  const lines = fs.readFileSync(csvPath, "utf8").trim().split(/\r?\n/);
  const rows = lines.map(parseCsvLine);
  const header = rows[0];
  const titleIdx = header.indexOf("Title");

  const batches = [];
  let current = [header];
  let count = 0;

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const isNewProduct = titleIdx >= 0 && row[titleIdx]?.trim();
    if (isNewProduct && count >= batchSize && current.length > 1) {
      batches.push(current);
      current = [header];
      count = 0;
    }
    if (isNewProduct) count++;
    current.push(row);
  }
  if (current.length > 1) batches.push(current);
  return batches;
}

function splitInventoryCsv(csvPath, productBatches) {
  if (!fs.existsSync(csvPath)) return [];

  const lines = fs.readFileSync(csvPath, "utf8").trim().split(/\r?\n/);
  const rows = lines.map(parseCsvLine);
  const header = rows[0];
  const handleIdx = header.indexOf("Handle");

  const handlesPerBatch = productBatches.map((batch) => {
    const titleIdx = batch[0].indexOf("Title");
    const set = new Set();
    for (let i = 1; i < batch.length; i++) {
      if (batch[i][titleIdx]?.trim()) set.add(batch[i][0]);
    }
    return set;
  });

  const invBatches = handlesPerBatch.map(() => [header]);
  for (let i = 1; i < rows.length; i++) {
    const handle = rows[i][handleIdx];
    const bi = handlesPerBatch.findIndex((s) => s.has(handle));
    if (bi >= 0) invBatches[bi].push(rows[i]);
  }
  return invBatches;
}

const productBatches = splitProductsCsv(productsCsv);
const inventoryBatches = splitInventoryCsv(invPath, productBatches);

fs.mkdirSync(outDir, { recursive: true });
const manifest = [];

productBatches.forEach((batch, idx) => {
  const n = String(idx + 1).padStart(2, "0");
  const titleIdx = batch[0].indexOf("Title");
  const products = batch.slice(1).filter((r) => r[titleIdx]?.trim()).length;

  const prodFile = path.join(outDir, `batch-${n}-products.csv`);
  fs.writeFileSync(prodFile, toCsv(batch), "utf8");

  let invFile = "";
  if (inventoryBatches[idx]?.length > 1) {
    invFile = path.join(outDir, `batch-${n}-inventory.csv`);
    fs.writeFileSync(invFile, toCsv(inventoryBatches[idx]), "utf8");
  }

  manifest.push({
    batch: idx + 1,
    products,
    rows: batch.length - 1,
    productsCsv: path.relative(ROOT, prodFile).replace(/\\/g, "/"),
    inventoryCsv: invFile ? path.relative(ROOT, invFile).replace(/\\/g, "/") : "",
  });
});

fs.writeFileSync(path.join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2), "utf8");
console.log(`拆成 ${productBatches.length} 批 → ${outDir}`);
manifest.forEach((m) =>
  console.log(`  batch-${String(m.batch).padStart(2, "0")}: ${m.products} 产品, ${m.rows} 行`)
);
