/**
 * 解析「独立站上货表单」单 Sheet（父体/子体列结构）→ manifest.json + images
 *
 * 分类三列（表单 10+，D/E/F）：
 *   D 产品系列(第1) → Shopify Type（类型）
 *   E 产品系列(第2) → Shopify Collection（产品系列）；与 Type 相同时由 store.json 自动映射
 *   F 类别          → Tags 中文标签
 *
 * 旧表单 9：D=系列(Type)、E=类别(Tags)。表单 7：另有「类目」列作 Type 回退。
 *
 * 列：链接指向 | 状态 | SKU 图片 | [类目] | 系列/产品系列×2 | 类别 | 价格 | SKU | 产品编码 | 产品标题 | 描述 | 产品图片1-8 | ...
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  arg,
  unzipXlsx,
  readXml,
  parseSharedStrings,
  parseSheet,
  loadWorkbookSheets,
  buildDispimgMap,
  extractDispimgId,
  slugify,
} from "./lib/xlsx-wps.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

const xlsxPath = arg(process.argv, "--xlsx");
const outDir = arg(process.argv, "--out", path.join(ROOT, "output", "shopify"));

if (!xlsxPath || !fs.existsSync(xlsxPath)) {
  console.error("用法: node scripts/extract-listing-form.mjs --xlsx <独立站上货表单.xlsx>");
  process.exit(1);
}

const COL = {
  link: "链接指向",
  status: "状态",
  skuImage: "SKU 图片",
  category: "类目",
  series: "系列",
  productSeries: "产品系列",
  subcategory: "类别",
  summary: "描述",
  price: "价格",
  optionLabel: "SKU（给客户看的）",
  productCode: "产品编码（给自己看的）",
  title: "产品标题",
};

function colIndices(headers, name) {
  const out = [];
  headers.forEach((h, i) => {
    if (h === name) out.push(i);
  });
  return out;
}

function colIndex(headers, name) {
  const i = headers.indexOf(name);
  return i >= 0 ? i : -1;
}

function cellByHeaderOccurrence(cells, headers, name, occurrence = 0) {
  const indices = colIndices(headers, name);
  const idx = indices[occurrence];
  if (idx === undefined) return "";
  return cells[colLetter(idx)] ?? "";
}

function cellFromRow(cells, headers, names) {
  for (const name of names) {
    const val = String(cellByHeader(cells, headers, name)).trim();
    if (val) return val;
  }
  return "";
}

function colLetter(i) {
  let n = i;
  let s = "";
  while (n >= 0) {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  }
  return s;
}

function cellByHeader(cells, headers, name) {
  const idx = colIndex(headers, name);
  if (idx < 0) return "";
  return cells[colLetter(idx)] ?? "";
}

function extractImagesFromRow(cells, headers, prefix, max = 8) {
  const out = [];
  for (let i = 1; i <= max; i++) {
    const val = cellByHeader(cells, headers, `${prefix}${i}`);
    const id = extractDispimgId(val);
    if (id) out.push(id);
  }
  return out;
}

function copyImage(srcPath, destPath) {
  if (!srcPath || !fs.existsSync(srcPath)) return null;
  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  fs.copyFileSync(srcPath, destPath);
  return path.basename(destPath);
}

function toHandle(code, title, linkId) {
  const base = slugify(String(code || title || `product-${linkId}`))
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return base || `product-${linkId}`;
}

function gramsFromOption(option) {
  const m = String(option).match(/(\d+)\s*g/i);
  return m ? parseInt(m[1], 10) : 0;
}

/** 子体前台 SKU 名重复时，用内部编码生成唯一 Option 值 */
function resolveUniqueOption(optionLabel, productCode, duplicateLabels) {
  const label = String(optionLabel || "").trim() || "Default";
  if (!duplicateLabels.has(label)) return label;
  const code = String(productCode || "").trim();
  if (!code) return label;
  const stripped = code.replace(/^TaoGuan\s+/i, "").trim();
  if (stripped && stripped !== code) return stripped;
  return code;
}

function resolveHandle(linkId, title, children, fallbackCode) {
  const codes = children
    .map((c) => String(c.productCode || "").trim())
    .filter(Boolean);
  if (codes.length >= 2) {
    const base = codes[0]
      .replace(/\s+[SL]\s+8PCS$/i, " 8PCS")
      .replace(/\s+8PCS$/i, " 8PCS");
    const h = toHandle(base, title, linkId);
    if (h && !h.startsWith("product-")) return h;
  }
  const code = fallbackCode || codes[0] || "";
  return toHandle(code, title, linkId);
}

function buildBody(headers, cells) {
  const parts = [];
  const summary = String(cellByHeader(cells, headers, COL.summary)).trim();
  if (summary) {
    for (const block of summary.split(/\n\s*\n/).map((s) => s.trim()).filter(Boolean)) {
      parts.push(`<p>${block.replace(/\n/g, "<br>")}</p>`);
    }
  }
  for (let i = 1; i <= 5; i++) {
    const t = cellByHeader(cells, headers, `详情页描述${i}`);
    if (t && String(t).trim()) parts.push(`<p>${String(t).trim()}</p>`);
  }
  return parts.length ? parts.join("") : "";
}

/**
 * 分类三字段（不可互换）：
 *   productType  — Shopify Type（类型），英文，如 CARP Method Feeder
 *   collection   — Shopify Collection（产品系列），英文，如 Method Feeder；可空，由 CSV 阶段按 Type 映射
 *   subcategory  — 中文细分类，写入 Tags，如 鱼饵容器
 *
 * 表单 10+：两列同名「产品系列」— 第 1 列=Type，第 2 列=Collection
 * 表单 9：「系列」=Type，「类别」=Tags
 */
function resolveTaxonomy(parentCells, childCells, headers) {
  const child = childCells ?? {};
  const legacyCategory = cellFromRow(parentCells, headers, [COL.category]);
  const subcategory =
    cellFromRow(parentCells, headers, [COL.subcategory]) ||
    cellFromRow(child, headers, [COL.subcategory]);

  const dualSeries = colIndices(headers, COL.productSeries).length >= 2;
  let productType = "";
  let collection = "";

  if (dualSeries) {
    productType =
      cellByHeaderOccurrence(parentCells, headers, COL.productSeries, 0) ||
      cellByHeaderOccurrence(child, headers, COL.productSeries, 0);
    collection =
      cellByHeaderOccurrence(parentCells, headers, COL.productSeries, 1) ||
      cellByHeaderOccurrence(child, headers, COL.productSeries, 1);
    if (collection && collection === productType) collection = "";
  } else {
    productType =
      cellFromRow(parentCells, headers, [COL.productSeries, COL.series]) ||
      cellFromRow(child, headers, [COL.productSeries, COL.series]);
  }

  if (!productType) productType = legacyCategory;

  return {
    productType: productType || undefined,
    collection: collection || undefined,
    series: productType || undefined,
    category: legacyCategory || undefined,
    subcategory: subcategory || undefined,
  };
}

const tmpDir = unzipXlsx(xlsxPath, outDir);
const xlDir = path.join(tmpDir, "xl");
const shared = parseSharedStrings(readXml(path.join(xlDir, "sharedStrings.xml")));
const dispimgMap = buildDispimgMap(xlDir);
const imagesDir = path.join(outDir, "images");
fs.mkdirSync(imagesDir, { recursive: true });

const baseName = path.basename(xlsxPath, path.extname(xlsxPath));
const catalog = { source: xlsxPath, name: baseName, sheets: [] };
let totalProducts = 0;
let totalVariants = 0;

for (const sheet of loadWorkbookSheets(xlDir)) {
  const rows = parseSheet(readXml(sheet.path), shared);
  if (!rows.length) continue;

  const headerRow = rows[0];
  const headers = [];
  for (let i = 0; i < 60; i++) {
    const v = headerRow.cells[colLetter(i)];
    if (v !== undefined && String(v).trim()) headers.push(String(v).trim());
    else if (headers.length) break;
  }

  const groups = new Map();
  for (const { rowNum, cells } of rows.slice(1)) {
    const link = String(cellByHeader(cells, headers, COL.link)).trim();
    const status = String(cellByHeader(cells, headers, COL.status)).trim();
    if (!link || !status) continue;
    if (!groups.has(link)) groups.set(link, { parent: null, children: [] });
    const g = groups.get(link);
    const row = { rowNum, cells };
    if (status === "父体") g.parent = row;
    else if (status === "子体") g.children.push(row);
  }

  const products = [];

  for (const [linkId, group] of groups) {
    const { parent, children } = group;
    if (!parent) continue;

    const title = String(cellByHeader(parent.cells, headers, COL.title)).trim();
    const tax = resolveTaxonomy(parent.cells, children[0]?.cells, headers);
    const productCode =
      String(cellByHeader(children[0]?.cells ?? {}, headers, COL.productCode)).trim() ||
      String(cellByHeader(parent.cells, headers, COL.productCode)).trim();

    const hasContent =
      title ||
      tax.productType ||
      tax.subcategory ||
      children.some((c) => cellByHeader(c.cells, headers, COL.price) || cellByHeader(c.cells, headers, COL.optionLabel));
    if (!hasContent) continue;

    const childDrafts = children.map((child) => ({
      optionLabel: String(cellByHeader(child.cells, headers, COL.optionLabel)).trim(),
      productCode: String(cellByHeader(child.cells, headers, COL.productCode)).trim(),
      priceRaw: cellByHeader(child.cells, headers, COL.price),
      cells: child.cells,
    }));
    const labelCounts = new Map();
    for (const c of childDrafts) {
      if (!c.optionLabel) continue;
      labelCounts.set(c.optionLabel, (labelCounts.get(c.optionLabel) || 0) + 1);
    }
    const duplicateLabels = new Set([...labelCounts.entries()].filter(([, n]) => n > 1).map(([k]) => k));

    const handle = resolveHandle(linkId, title, childDrafts, productCode);
    const body = buildBody(headers, parent.cells) || (title ? `<p>${title}</p>` : "");

    const productImgIds = extractImagesFromRow(parent.cells, headers, "产品图片");
    const galleryFiles = [];
    productImgIds.forEach((id, idx) => {
      const src = dispimgMap[id];
      const fname = copyImage(src, path.join(imagesDir, `${handle}-${idx + 1}${path.extname(src || ".jpeg")}`));
      if (fname) galleryFiles.push(fname);
    });

    const detailImgIds = extractImagesFromRow(parent.cells, headers, "详情页图片", 5);
    detailImgIds.forEach((id, idx) => {
      const src = dispimgMap[id];
      copyImage(src, path.join(imagesDir, `${handle}-detail-${idx + 1}${path.extname(src || ".jpeg")}`));
    });

    const variants = [];
    const usedOptions = new Set();
    for (let vi = 0; vi < childDrafts.length; vi++) {
      const child = childDrafts[vi];
      let option = String(child.optionLabel || "").trim();
      if (!option) {
        option = resolveUniqueOption(child.optionLabel, child.productCode, duplicateLabels);
      }
      if (usedOptions.has(option)) {
        const base = child.optionLabel || child.productCode || option || "Variant";
        let n = 2;
        while (usedOptions.has(`${base} (${n})`)) n++;
        option = `${base} (${n})`;
      }
      usedOptions.add(option);
      const priceRaw = child.priceRaw;
      const code = child.productCode || productCode;
      if (!option && !priceRaw) continue;

      const price = String(priceRaw).replace(/[^\d.]/g, "") || "1.99";
      const skuSuffix = slugify(option).replace(/-/g, "") || "default";
      const sku = code ? `${code}-${skuSuffix}`.replace(/\s+/g, "-") : `${handle}-${skuSuffix}`;

      const skuImgId = extractDispimgId(cellByHeader(child.cells, headers, COL.skuImage));
      let variantImageFile = null;
      if (skuImgId && dispimgMap[skuImgId]) {
        variantImageFile = copyImage(
          dispimgMap[skuImgId],
          path.join(imagesDir, `${handle}-${slugify(option)}${path.extname(dispimgMap[skuImgId] || ".jpeg")}`)
        );
      }

      variants.push({
        sku,
        option: option || "Default",
        price,
        grams: gramsFromOption(option),
        imageFile: variantImageFile,
      });
      totalVariants++;
    }

    if (!variants.length) continue;

    totalProducts++;
    products.push({
      linkId,
      handle,
      skuBase: handle,
      name: productCode || title,
      nameEn: title,
      title,
      body,
      sheet: sheet.name,
      series: tax.series,
      collection: tax.collection,
      category: tax.category,
      subcategory: tax.subcategory,
      productType: tax.productType,
      attributeName: variants.every((v) => /g/i.test(v.option)) ? "Weight" : "Specification",
      tags: tax.subcategory || tax.category || undefined,
      variants,
      imageFile: galleryFiles[0] ?? variants[0]?.imageFile ?? null,
      galleryFiles,
    });
  }

  if (products.length) {
    catalog.sheets.push({ name: sheet.name, products });
  }
}

const manifestPath = path.join(outDir, "manifest.json");
fs.writeFileSync(manifestPath, JSON.stringify(catalog, null, 2), "utf8");

try {
  fs.rmSync(tmpDir, { recursive: true, force: true });
} catch {}

console.log("manifest:", manifestPath);
console.log("images:", imagesDir);
console.log(`解析 ${totalProducts} 个产品，${totalVariants} 个变体`);
