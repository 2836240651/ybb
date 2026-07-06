import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MANIFEST_PATH = path.join(ROOT, "deploy", "product-import", "manifest.json");
const CATALOG_PATH = path.join(ROOT, "deploy", "product-import", "wc-catalog.json");
const OUT_DIR = path.join(ROOT, "deploy", "product-import");
const SOURCES_DIR = path.join(OUT_DIR, "tz-qz-image-sources");
const CHECKLIST_PATH = path.join(OUT_DIR, "tz-qz-image-checklist.csv");
const XLSX_PATH = process.argv.includes("--xlsx")
  ? process.argv[process.argv.indexOf("--xlsx") + 1]
  : path.join(process.env.USERPROFILE || "C:\\Users\\Administrator", "Desktop", "产品表单.xlsx");

function unzipXlsx(xlsxPath) {
  const tmpDir = path.join(OUT_DIR, "_tzqz_xlsx");
  const zipCopy = path.join(OUT_DIR, "_tzqz_xlsx.zip");
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.copyFileSync(xlsxPath, zipCopy);
  if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true, force: true });
  execSync(
    `powershell -NoProfile -Command "Expand-Archive -LiteralPath '${zipCopy.replace(/'/g, "''")}' -DestinationPath '${tmpDir.replace(/'/g, "''")}' -Force"`,
    { stdio: "inherit" }
  );
  try {
    fs.unlinkSync(zipCopy);
  } catch {}
  return tmpDir;
}

function readText(p) {
  return fs.existsSync(p) ? fs.readFileSync(p, "utf8") : "";
}

function buildDispimgMap(xlDir) {
  const cellImages = readText(path.join(xlDir, "cellimages.xml"));
  const rels = readText(path.join(xlDir, "_rels", "cellimages.xml.rels"));
  const ridToMedia = {};
  for (const m of rels.matchAll(/Id="(rId\d+)"[^>]*Target="media\/([^"]+)"/g)) {
    ridToMedia[m[1]] = m[2];
  }
  const map = {};
  for (const m of cellImages.matchAll(/name="(ID_[A-F0-9]+)"[\s\S]*?r:embed="(rId\d+)"/g)) {
    const media = ridToMedia[m[2]];
    if (media) map[m[1]] = path.join(xlDir, "media", media);
  }
  return map;
}

function toHandle(sku) {
  return String(sku || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function csvEscape(v) {
  const s = String(v ?? "");
  if (/[",\n]/.test(s)) return `"${s.replaceAll('"', '""')}"`;
  return s;
}

function main() {
  if (!fs.existsSync(XLSX_PATH)) {
    throw new Error(`xlsx not found: ${XLSX_PATH}`);
  }
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
  const catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, "utf8"));

  const tmpDir = unzipXlsx(XLSX_PATH);
  const xlDir = path.join(tmpDir, "xl");
  const dispimgMap = buildDispimgMap(xlDir);
  fs.mkdirSync(SOURCES_DIR, { recursive: true });

  const variantToRef = new Map();
  const parentFirstRef = new Map();
  for (const row of manifest.imageRefs || []) {
    const parentSku = String(row.parentSku || "");
    const variantSku = String(row.variantSku || "");
    const dispimgId = String(row.dispimgId || "");
    if (variantSku && dispimgId) variantToRef.set(variantSku, dispimgId);
    if (parentSku && dispimgId && !parentFirstRef.has(parentSku)) parentFirstRef.set(parentSku, dispimgId);
  }

  const lines = [
    [
      "parent_sku",
      "variant_sku",
      "variant_handle",
      "dispimg_id",
      "source_file",
      "status",
    ].join(","),
  ];

  let ok = 0;
  let miss = 0;
  for (const p of catalog.products || []) {
    const parentSku = String(p.parentSku || "");
    if (!parentSku.startsWith("TZ-QZ-")) continue;
    const vars = Array.isArray(p.variations) ? p.variations : [];
    const parentRef = parentFirstRef.get(parentSku) || "";
    const srcRaw = parentRef ? dispimgMap[parentRef] : null;
    let copied = "";
    if (srcRaw && fs.existsSync(srcRaw)) {
      const ext = path.extname(srcRaw) || ".png";
      copied = path.join(SOURCES_DIR, `${toHandle(parentSku)}${ext}`);
      fs.copyFileSync(srcRaw, copied);
    }

    for (const v of vars) {
      const variantSku = String(v.sku || "");
      const ref = variantToRef.get(variantSku) || parentRef || "";
      const status = copied ? "ok" : ref ? "missing-source" : "missing-dispimg";
      if (status === "ok") ok += 1;
      else miss += 1;
      lines.push(
        [
          csvEscape(parentSku),
          csvEscape(variantSku),
          csvEscape(toHandle(variantSku)),
          csvEscape(ref),
          csvEscape(copied),
          csvEscape(status),
        ].join(",")
      );
    }
  }

  fs.writeFileSync(CHECKLIST_PATH, `${lines.join("\n")}\n`, "utf8");
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch {}

  console.log(`[extract-tz-qz-dispimg] xlsx=${XLSX_PATH}`);
  console.log(`[extract-tz-qz-dispimg] checklist=${CHECKLIST_PATH}`);
  console.log(`[extract-tz-qz-dispimg] ok=${ok} missing=${miss}`);
}

main();
