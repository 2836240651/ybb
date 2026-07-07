/**
 * multi-sheet manifest → Shopify 产品 CSV + 库存 CSV
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { classifyTitle, resolveCollection } from "./lib/taxonomy.mjs";
import { toCsv } from "./lib/csv.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

function arg(name, fallback = "") {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const configPath = arg("--config", path.join(ROOT, "config", "store.json"));
const manifestPath = arg("--manifest", path.join(ROOT, "output", "shopify", "manifest.json"));
const outDir = arg("--out", path.join(ROOT, "output", "shopify"));

if (!fs.existsSync(configPath)) {
  console.error("未找到配置:", configPath);
  process.exit(1);
}
if (!fs.existsSync(manifestPath)) {
  console.error("未找到 manifest:", manifestPath);
  console.error("请先运行: node scripts/extract-shopify-catalog.mjs --xlsx <表单.xlsx>");
  process.exit(1);
}

const cfg = JSON.parse(fs.readFileSync(configPath, "utf8"));
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const sheets = manifest.sheets ?? [];

const baseHeader = [
  "Handle", "Title", "Body (HTML)", "Vendor", "Product Category", "Type", "Collection", "Tags",
  "Published", "Option1 Name", "Option1 Value", "Option2 Name", "Option2 Value", "Option3 Name", "Option3 Value",
  "Variant SKU", "Variant Grams", "Variant Inventory Tracker", "Variant Inventory Qty",
  "Variant Inventory Policy", "Variant Fulfillment Service", "Variant Price", "Variant Compare At Price",
  "Variant Requires Shipping", "Variant Taxable", "Variant Barcode",
];
const imageHeader = ["Image Src", "Image Position", "Image Alt Text"];
const tailHeader = ["Gift Card", "SEO Title", "SEO Description", "Status"];

let hasAnyImage = false;
for (const sheet of sheets) {
  for (const p of sheet.products ?? []) {
    if (p.imageUrl || p.imageSrc) {
      hasAnyImage = true;
      break;
    }
  }
  if (hasAnyImage) break;
}

const productHeader = [...baseHeader, ...(hasAnyImage ? imageHeader : []), ...tailHeader];

const invHeader = [
  "Handle", "Title", "Option1 Name", "Option1 Value", "Option2 Name", "Option2 Value",
  "Option3 Name", "Option3 Value", "SKU", "HS Code", "COO", "Location", "Bin name",
  "Incoming (not editable)", "Unavailable (not editable)", "Committed (not editable)",
  "Available (not editable)", "On hand (current)", "On hand (new)",
];

const productRows = [productHeader];
const invRows = [invHeader];
let productCount = 0;
let variantCount = 0;
const metaProducts = [];

function option1NameFor(p) {
  const name = p.attributeName || cfg.sheetAttributeMap?.[p.sheet] || "Weight";
  return name.toUpperCase().replace(/\s+/g, " ");
}

function gramsFromOption(option) {
  const m = String(option).match(/(\d+)\s*g/i);
  return m ? parseInt(m[1], 10) : 0;
}

function resolveCategory(p, title) {
  const sheetKey = cfg.sheetCategoryRules?.[p.sheet];
  if (sheetKey && cfg.categoryRules?.[sheetKey]) {
    const rule = cfg.categoryRules[sheetKey];
    return { key: sheetKey, taxonomyId: rule.taxonomyId, labelZh: rule.labelZh };
  }
  return classifyTitle(title, cfg.categoryRules, cfg.defaultCategory);
}

for (const sheet of sheets) {
  for (const p of sheet.products ?? []) {
    if (!p.variants?.length) continue;
    productCount++;

    const handle = p.handle ?? p.skuBase?.toLowerCase();
    const title = p.title ?? `${cfg.titlePrefix}${p.nameEn ?? p.nameZh ?? handle}`;
    const productType = p.productType ?? cfg.sheetProductType?.[p.sheet] ?? cfg.productType;
    const collectionName = p.collection ?? resolveCollection(productType, cfg.collections);
    const cat = resolveCategory(p, title);
    const body = p.body ?? `<p>${title}</p><p>${p.nameZh || p.name} · ${p.sheet}</p>`;
    const imageSrc = p.imageUrl ?? p.imageSrc ?? "";
    const baseTags = cfg.tags ?? "";
    const tags = p.tags
      ? `${baseTags}, ${p.tags}`.replace(/^,\s*/, "")
      : `${baseTags}, ${p.sheet}`;
    const optName = option1NameFor(p);

    p.variants.forEach((v, vi) => {
      variantCount++;
      const sku = v.sku ?? p.skuBase;
      const optionVal = v.option ?? v.option1 ?? "Default";
      const grams = v.grams ?? gramsFromOption(optionVal);
      const price = v.priceUsd ?? v.price ?? cfg.defaultPrice;

      const baseRow = () => {
        if (vi === 0) {
          return [
            handle, title, body, cfg.vendor, cat.taxonomyId, productType, collectionName, tags,
            "TRUE", optName, optionVal, "", "", "", "",
            sku, String(grams), "shopify", cfg.inventoryQty, "deny", "manual", price, "",
            "TRUE", "TRUE", "",
            ...(hasAnyImage ? [imageSrc, imageSrc ? "1" : "", title] : []),
            "FALSE", title, title, "active",
          ];
        }
        return [
          handle, "", "", "", "", "", "", "", "", optName, optionVal, "", "", "", "",
          sku, String(grams), "shopify", cfg.inventoryQty, "deny", "manual", price, "",
          "TRUE", "TRUE", "",
          ...(hasAnyImage ? ["", "", ""] : []),
          "FALSE", "", "",
        ];
      };

      productRows.push(baseRow());

      invRows.push([
        handle, title, optName, optionVal, "", "", "", "",
        sku, "", "", cfg.location, "", "0", "0", "0", cfg.inventoryQty, cfg.inventoryQty,
      ]);
    });

    metaProducts.push({ handle, title, sheet: p.sheet, productType, collection: collectionName, category: cat });
  }
}

fs.mkdirSync(outDir, { recursive: true });
const base = manifest.name ?? path.basename(manifestPath, ".json");
const productsCsv = path.join(outDir, `${base}_products_import.csv`);
const inventoryCsv = path.join(outDir, `${base}_inventory_import.csv`);

fs.writeFileSync(productsCsv, toCsv(productRows), "utf8");
fs.writeFileSync(inventoryCsv, toCsv(invRows), "utf8");

const meta = {
  generatedAt: new Date().toISOString(),
  productsCsv,
  inventoryCsv,
  productCount,
  variantCount,
  products: metaProducts,
};

fs.writeFileSync(path.join(outDir, `${base}_meta.json`), JSON.stringify(meta, null, 2), "utf8");
console.log("产品 CSV:", productsCsv);
console.log("库存 CSV:", inventoryCsv);
console.log(`共 ${productCount} 产品 / ${variantCount} 变体${hasAnyImage ? "" : "（无图片列）"}`);
