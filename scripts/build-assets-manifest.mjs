/**
 * Build omc-replica/assets-manifest.csv from wc-catalog + extracted Excel images.
 *
 * Prereq: py scripts/extract-product-images.py --xlsx ... --output <imageDir>
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CATALOG_PATH = path.join(ROOT, "deploy/product-import/wc-catalog.json");
const OUT_CSV = path.join(ROOT, "..", "assets-manifest.csv");

function parseArgs() {
  const args = process.argv.slice(2);
  const imageDirIdx = args.indexOf("--image-dir");
  const outIdx = args.indexOf("--out");
  return {
    imageDir:
      imageDirIdx >= 0
        ? args[imageDirIdx + 1]
        : path.join(process.env.USERPROFILE || "", "Pictures", "excel表单图"),
    out: outIdx >= 0 ? args[outIdx + 1] : OUT_CSV,
  };
}

function toHandle(sku) {
  return String(sku || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function findImageFile(dir, stem) {
  if (!stem || !fs.existsSync(dir)) return null;
  const exts = [".webp", ".jpg", ".jpeg", ".png", ".gif"];
  for (const ext of exts) {
    const p = path.join(dir, `${stem}${ext}`);
    if (fs.existsSync(p)) return p;
  }
  const lower = stem.toLowerCase();
  for (const name of fs.readdirSync(dir)) {
    if (name.toLowerCase().startsWith(lower + ".")) {
      return path.join(dir, name);
    }
  }
  return null;
}

function csvEscape(v) {
  const s = String(v ?? "");
  if (/[",\n]/.test(s)) return `"${s.replaceAll('"', '""')}"`;
  return s;
}

function main() {
  const { imageDir, out } = parseArgs();
  if (!fs.existsSync(CATALOG_PATH)) {
    throw new Error(`missing ${CATALOG_PATH} — run parse-product-form.py first`);
  }

  const catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, "utf8"));
  const rows = [["handle", "parent_sku", "title_en", "primary_image", "status"]];
  let ok = 0;
  let miss = 0;

  for (const product of catalog.products || []) {
    const parentSku = String(product.parentSku || "");
    const handle = toHandle(parentSku);
    const title = String(product.name || product.nameEn || parentSku);
    let source =
      findImageFile(imageDir, parentSku) ||
      findImageFile(imageDir, handle.toUpperCase()) ||
      null;

    if (!source && Array.isArray(product.variations)) {
      for (const v of product.variations) {
        source = findImageFile(imageDir, String(v.sku || ""));
        if (source) break;
      }
    }

    const status = source ? "ok" : "missing";
    if (source) ok += 1;
    else miss += 1;

    rows.push(
      [handle, parentSku, title, source || "", status].map(csvEscape).join(",")
    );
  }

  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, `${rows.join("\n")}\n`, "utf8");
  console.log(`[build-assets-manifest] imageDir=${imageDir}`);
  console.log(`[build-assets-manifest] out=${out}`);
  console.log(`[build-assets-manifest] ok=${ok} missing=${miss}`);
  if (miss > 0) process.exitCode = 2;
}

main();
