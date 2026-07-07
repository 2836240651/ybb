import fs from "fs";
import path from "path";
import { execSync } from "child_process";

export function arg(argv, name, fallback = "") {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
}

export function unzipXlsx(xlsxPath, outDir) {
  const tmpDir = path.join(outDir, "_wp_sheet");
  const zipCopy = path.join(outDir, "_wp_xlsx.zip");
  fs.mkdirSync(outDir, { recursive: true });
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

export function readXml(p) {
  return fs.existsSync(p) ? fs.readFileSync(p, "utf8") : "";
}

export function parseSharedStrings(xml) {
  const out = [];
  for (const m of xml.matchAll(/<si>[\s\S]*?<t[^>]*>([\s\S]*?)<\/t>[\s\S]*?<\/si>/g)) {
    out.push(m[1].replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">"));
  }
  return out;
}

export function cellValue(c, shared) {
  const t = (c.match(/t="([^"]+)"/) || [])[1];
  const v = (c.match(/<v>([\s\S]*?)<\/v>/) || [])[1] ?? "";
  if (t === "s") return shared[Number(v)] ?? v;
  return v;
}

export function parseSheet(xml, shared) {
  const rows = [];
  for (const rm of xml.matchAll(/<row r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g)) {
    const rowNum = Number(rm[1]);
    const cells = {};
    for (const cm of rm[2].matchAll(/<c r="([A-Z]+)(\d+)"([^>]*)>([\s\S]*?)<\/c>/g)) {
      cells[cm[1]] = cellValue(cm[3] + cm[4], shared);
    }
    rows.push({ rowNum, cells });
  }
  return rows;
}

export function loadWorkbookSheets(xlDir) {
  const wb = readXml(path.join(xlDir, "workbook.xml"));
  const rels = readXml(path.join(xlDir, "_rels", "workbook.xml.rels"));
  const ridToTarget = {};
  for (const m of rels.matchAll(/Id="(rId\d+)"[^>]*Target="([^"]+)"/g)) {
    ridToTarget[m[1]] = m[2];
  }
  const sheets = [];
  for (const m of wb.matchAll(/<sheet[^>]*name="([^"]+)"[^>]*r:id="(rId\d+)"/g)) {
    const name = m[1];
    if (name.startsWith("WpsReserved")) continue;
    const target = ridToTarget[m[2]];
    sheets.push({ name, path: path.join(xlDir, target) });
  }
  return sheets;
}

/** WPS DISPIMG("ID_xxx",1) → image file path */
export function buildDispimgMap(xlDir) {
  const cellImages = readXml(path.join(xlDir, "cellimages.xml"));
  const rels = readXml(path.join(xlDir, "_rels", "cellimages.xml.rels"));
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

export function extractDispimgId(val) {
  const m = String(val || "").match(/ID_[A-F0-9]+/);
  return m ? m[0] : null;
}

export function isWeightLike(s) {
  return /^\d+\s*g$/i.test(String(s).trim()) || /^\d+g$/i.test(String(s).trim());
}

export function isSpecOnly(s) {
  const t = String(s).trim();
  if (!t) return true;
  if (isWeightLike(t)) return true;
  if (/^[\d#]+#?$/.test(t)) return true;
  if (/^(S|M|L|XL|XXL)$/i.test(t)) return true;
  if (/^(black|white|grey|gray|green|blue|red|orange|yellow)$/i.test(t)) return true;
  if (/^\d+(\.\d+)?mm$/i.test(t)) return true;
  if (/^[\d/]+g/i.test(t) && t.includes("/")) return true;
  return false;
}

export function slugify(s) {
  return String(s)
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fff]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}
