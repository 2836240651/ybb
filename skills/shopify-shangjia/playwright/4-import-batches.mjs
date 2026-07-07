/**
 * 分批导入 Shopify 产品 + 库存 CSV
 * 用法: node 4-import-batches.mjs [--from 1] [--to 20] [--products-only] [--continue-on-error]
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createAuthedPage, closeAuthedPage, importProducts, importInventory } from "./lib/import-helpers.mjs";
import { loadConfig } from "./lib/config.mjs";
import { AUTH_FILE } from "./lib/browser.mjs";
import { PRODUCT_IMPORT_WAIT_MS, INVENTORY_IMPORT_WAIT_MS } from "./lib/timeouts.mjs";

const PW_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)));
const ROOT = path.join(PW_ROOT, "..");
const batchDir = path.join(ROOT, "output", "shopify", "batches");
const manifestPath = path.join(batchDir, "manifest.json");
const logPath = path.join(batchDir, "import-log.json");

function arg(name, fallback = "") {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

if (!fs.existsSync(manifestPath)) {
  console.error("未找到:", manifestPath);
  process.exit(1);
}

if (!fs.existsSync(AUTH_FILE)) {
  console.error("未找到 shopify-auth.json，请先 npm run open-chrome && npm run capture");
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const startIdx = Number(arg("--from", "1")) - 1;
const endIdx = arg("--to", "") ? Number(arg("--to", "")) - 1 : manifest.length - 1;
const productsOnly = process.argv.includes("--products-only");
const inventoryOnly = process.argv.includes("--inventory-only");
const continueOnError = process.argv.includes("--continue-on-error");
const cfg = loadConfig();
const store = cfg.store;
const locationId = cfg.locationId;

function resolveBatchFile(rel) {
  return path.isAbsolute(rel) ? rel : path.join(ROOT, rel.replace(/\//g, path.sep));
}

function loadLog() {
  if (fs.existsSync(logPath)) {
    try {
      return JSON.parse(fs.readFileSync(logPath, "utf8"));
    } catch {
      return { batches: [] };
    }
  }
  return { batches: [], startedAt: new Date().toISOString() };
}

function saveLog(log) {
  log.updatedAt = new Date().toISOString();
  fs.writeFileSync(logPath, JSON.stringify(log, null, 2), "utf8");
}

const log = loadLog();
console.log(`共 ${manifest.length} 批 | 执行 ${startIdx + 1}–${endIdx + 1} | 产品超时 ${PRODUCT_IMPORT_WAIT_MS / 1000}s / 库存 ${INVENTORY_IMPORT_WAIT_MS / 1000}s`);
console.log("进度日志:", logPath);

for (let i = startIdx; i <= endIdx && i < manifest.length; i++) {
  const b = manifest[i];
  const batchNum = i + 1;
  const batchTag = `-batch-${String(batchNum).padStart(2, "0")}`;
  const prodCsv = resolveBatchFile(b.productsCsv);
  const invCsv = b.inventoryCsv ? resolveBatchFile(b.inventoryCsv) : "";

  const prev = log.batches.find((x) => x.batch === batchNum && x.status === "ok");
  if (prev && !process.argv.includes("--force")) {
    console.log(`\n=== 批次 ${batchNum} 已成功，跳过（加 --force 重跑）===`);
    continue;
  }

  console.log(`\n=== 批次 ${batchNum}/${manifest.length}: ${b.products} 产品 ===`);
  const entry = {
    batch: batchNum,
    products: b.products,
    productsCsv: b.productsCsv,
    startedAt: new Date().toISOString(),
    status: "running",
  };
  log.batches = log.batches.filter((x) => x.batch !== batchNum);
  log.batches.push(entry);
  saveLog(log);

  const { browser, context, page, ownsPage } = await createAuthedPage({ preferCdp: true, preferFresh: false });
  try {
    if (!inventoryOnly) {
      await importProducts(page, prodCsv, store, { batchTag, requireOverwrite: productsOnly });
      entry.productsStatus = "ok";
      await context.storageState({ path: AUTH_FILE });
    }

    if (!productsOnly && invCsv && fs.existsSync(invCsv)) {
      console.log("库存 CSV:", invCsv);
      await importInventory(page, invCsv, store, locationId, { batchTag });
      entry.inventoryStatus = "ok";
      await context.storageState({ path: AUTH_FILE });
    }

    entry.status = "ok";
    entry.finishedAt = new Date().toISOString();
    console.log(`✓ 批次 ${batchNum} 完成`);
  } catch (err) {
    entry.status = "failed";
    entry.error = String(err.message || err).slice(0, 500);
    entry.finishedAt = new Date().toISOString();
    console.error(`✗ 批次 ${batchNum} 失败:`, entry.error);
    saveLog(log);
    if (!continueOnError) {
      console.error("\n已停止。修复后: npm run import:batches -- --from", batchNum, "[--force]");
      process.exit(1);
    }
  } finally {
    await closeAuthedPage({ browser, page, ownsPage });
    saveLog(log);
  }

  if (i < endIdx) await new Promise((r) => setTimeout(r, 3000));
}

const ok = log.batches.filter((x) => x.status === "ok").length;
const failed = log.batches.filter((x) => x.status === "failed").length;
console.log(`\n导入结束：成功 ${ok} 批，失败 ${failed} 批 → ${logPath}`);
