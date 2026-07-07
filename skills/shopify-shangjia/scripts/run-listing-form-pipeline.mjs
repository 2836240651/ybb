#!/usr/bin/env node
/**
 * 独立站上货表单（父体/子体）→ manifest → CSV → 分批 → 导入 → GraphQL 挂图
 *
 * 用法:
 *   node scripts/run-listing-form-pipeline.mjs --xlsx "独立站上货表单(7).xlsx"
 *   node scripts/run-listing-form-pipeline.mjs --xlsx "..." --skip-import --skip-images
 */
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

function arg(name, fallback = "") {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const xlsx = arg("--xlsx");
if (!xlsx || !fs.existsSync(xlsx)) {
  console.error("用法: node scripts/run-listing-form-pipeline.mjs --xlsx <独立站上货表单.xlsx>");
  process.exit(1);
}

const skipImport = process.argv.includes("--skip-import");
const skipImages = process.argv.includes("--skip-images");
const baseName = path.basename(xlsx, path.extname(xlsx));
const outDir = path.join(ROOT, "output", "shopify", baseName);
const config = path.join(ROOT, "config", "store.json");

function run(cmd) {
  console.log("\n>>", cmd);
  execSync(cmd, { stdio: "inherit", cwd: ROOT, shell: true });
}

run(
  `node "${path.join(__dirname, "extract-listing-form.mjs")}" --xlsx "${xlsx}" --out "${outDir}"`
);
run(
  `node "${path.join(__dirname, "generate-shopify-csv.mjs")}" --manifest "${path.join(outDir, "manifest.json")}" --config "${config}" --out "${outDir}"`
);

const productsCsv = path.join(outDir, `${baseName}_products_import.csv`);
run(
  `node "${path.join(__dirname, "split-shopify-csv.mjs")}" --csv "${productsCsv}" --out "${path.join(outDir, "batches")}"`
);

fs.copyFileSync(
  path.join(outDir, "batches", "manifest.json"),
  path.join(ROOT, "output", "shopify", "batches", "manifest.json")
);

console.log("\n=== CSV 已生成 ===");
console.log("产品:", productsCsv);
console.log("输出目录:", outDir);

if (!skipImport) {
  run(
    `node "${path.join(ROOT, "playwright", "4-import-batches.mjs")}" --from 1 --continue-on-error --force`
  );
}

if (!skipImages) {
  if (skipImport) {
    console.warn("\n⚠ 已跳过导入；请确认产品已在后台存在后再挂图");
  }
  run(
    `node "${path.join(ROOT, "playwright", "attach-listing-images-gql.mjs")}" --manifest "${path.join(outDir, "manifest.json")}"`
  );
}

console.log("\n=== 独立站上货表单流水线完成 ===");
