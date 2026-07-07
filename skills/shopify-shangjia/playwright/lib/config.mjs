import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..", "..");

export function loadConfig() {
  const p = path.join(ROOT, "config", "store.json");
  if (!fs.existsSync(p)) {
    throw new Error(`未找到 ${p}，请复制 config/store.example.json 为 config/store.json`);
  }
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

export function outputCsvPaths(cfg, manifestName) {
  const out = path.join(ROOT, "output");
  const base = manifestName ?? findLatestBase(out);
  return {
    products: path.join(out, `${base}_products_import.csv`),
    inventory: path.join(out, `${base}_inventory_import.csv`),
  };
}

function findLatestBase(outDir) {
  const files = fs.readdirSync(outDir).filter((f) => f.endsWith("_products_import.csv"));
  if (!files.length) throw new Error("output 下无 products CSV，请先 generate-csv");
  return files[0].replace("_products_import.csv", "");
}

export { ROOT, __dirname };
