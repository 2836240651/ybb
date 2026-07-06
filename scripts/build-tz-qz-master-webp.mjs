import { existsSync, mkdirSync, readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const CHECKLIST = join(ROOT, "deploy/product-import/tz-qz-image-checklist.csv");
const TARGETS = [join(ROOT, "public/products"), join(ROOT, "out/products")];
const PLACEHOLDER = join(ROOT, "public/images/placeholder-product.jpg");

function parseCsv(text) {
  const lines = text.trim().split("\n");
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

async function exportOne(sourceFile, variantHandle) {
  for (const base of TARGETS) {
    const outDir = join(base, variantHandle);
    const outPath = join(outDir, "master.webp");
    mkdirSync(outDir, { recursive: true });
    await sharp(sourceFile)
      .rotate()
      .resize({ width: 1200, height: 1200, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82, effort: 4 })
      .toFile(outPath);
  }
}

async function main() {
  if (!existsSync(CHECKLIST)) {
    throw new Error(`missing checklist: ${CHECKLIST}`);
  }
  const rows = parseCsv(readFileSync(CHECKLIST, "utf8"));
  let ok = 0;
  let fallback = 0;
  let skip = 0;
  for (const row of rows) {
    const hasSource =
      row.status === "ok" && row.source_file && existsSync(row.source_file);
    const sourceFile = hasSource ? row.source_file : PLACEHOLDER;
    if (!existsSync(sourceFile)) {
      skip += 1;
      continue;
    }
    if (!hasSource) fallback += 1;
    await exportOne(sourceFile, row.variant_handle);
    ok += 1;
  }
  console.log(
    `[build-tz-qz-master-webp] exported=${ok} fallback=${fallback} skipped=${skip}`
  );
}

main().catch((err) => {
  console.error("[build-tz-qz-master-webp] failed:", err?.message || err);
  process.exit(1);
});
