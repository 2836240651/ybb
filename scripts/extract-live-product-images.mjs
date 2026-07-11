#!/usr/bin/env node
/**
 * Extract DISPIMG sources for live Woo SKUs → D:\dev\独立站上架\output\wp\images
 * Usage: node scripts/extract-live-product-images.mjs [--xlsx path]
 */
import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = "D:\\dev\\独立站上架\\output\\wp\\images";
const LIVE_SKUS = ["TZ-HK-001", "TZ-ZJ-002", "TZ-ELDZ-013", "TZ-XZ-014", "TZ-XZ-004"];
const XLSX_PATH = process.argv.includes("--xlsx")
  ? process.argv[process.argv.indexOf("--xlsx") + 1]
  : path.join(process.env.USERPROFILE || "C:\\Users\\Administrator", "Pictures", "excel表单图", "产品表单.xlsx");

function unzipXlsx(xlsxPath) {
  const tmpDir = path.join(ROOT, "deploy", "product-import", "_live_xlsx");
  const zipCopy = path.join(ROOT, "deploy", "product-import", "_live_xlsx.zip");
  fs.mkdirSync(path.dirname(tmpDir), { recursive: true });
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

const IMAGE_FILES = {
  "TZ-HK-001": "TZ-HK-001.jpeg",
  "TZ-ZJ-002": "TZ-ZJ-002.jpeg",
  "TZ-ELDZ-013": "TZ-ELDZ-013.jpeg",
  "TZ-XZ-014": "TZ-XZ-014.png",
  "TZ-XZ-004": "TZ-XZ-004.jpeg",
};

const DISPIMG_REFS = {
  "TZ-HK-001": "ID_D7B5D867340D4847AB2A24CCA7BF43DF",
  "TZ-ZJ-002": "ID_3276CC10CF87483EA97756C6EABEFFB0",
  "TZ-ELDZ-013": "ID_ACD44CA73F5B47DFB41AE40EDB269BE0",
  "TZ-XZ-014": "ID_B64EA243CD6B4CE29FD711BCFB5AAFE5",
  "TZ-XZ-004": "ID_62EA9D0B3DBF4A0FAA57235D093B7902",
};

function parentFirstRef() {
  return new Map(Object.entries(DISPIMG_REFS));
}

function main() {
  if (!fs.existsSync(XLSX_PATH)) throw new Error(`xlsx not found: ${XLSX_PATH}`);

  const refs = parentFirstRef();

  const tmpDir = unzipXlsx(XLSX_PATH);
  const dispimgMap = buildDispimgMap(path.join(tmpDir, "xl"));
  fs.mkdirSync(OUT_DIR, { recursive: true });

  let ok = 0;
  let fail = 0;
  for (const sku of LIVE_SKUS) {
    const imageFile = IMAGE_FILES[sku] || `${sku}.jpeg`;
    const ref = refs.get(sku);
    const src = ref ? dispimgMap[ref] : null;
    const dest = path.join(OUT_DIR, imageFile);
    if (src && fs.existsSync(src)) {
      fs.copyFileSync(src, dest);
      console.log(`[extract-live] OK ${sku} -> ${dest}`);
      ok += 1;
    } else {
      console.error(`[extract-live] FAIL ${sku} ref=${ref || "-"} src=${src || "-"}`);
      fail += 1;
    }
  }

  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch {}

  console.log(`[extract-live] done ok=${ok} fail=${fail} out=${OUT_DIR}`);
  if (fail) process.exit(1);
}

main();
