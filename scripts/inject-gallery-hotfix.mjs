#!/usr/bin/env node
/** Inject gallery hotfix script into product PDP html under out/ */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "out");
const TAG = '<script src="/scripts/gallery-single-thumb-hotfix.js" defer></script>';

function walk(dir, acc = []) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    if (fs.statSync(p).isDirectory()) walk(p, acc);
    else if (name.endsWith(".html")) acc.push(p);
  }
  return acc;
}

let n = 0;
for (const file of walk(path.join(OUT, "products"))) {
  if (file.includes(`${path.sep}reviews${path.sep}`)) continue;
  let html = fs.readFileSync(file, "utf8");
  if (html.includes("gallery-single-thumb-hotfix.js")) continue;
  if (!html.includes("data-gallery-layout")) continue;
  html = html.replace("</body>", `${TAG}</body>`);
  fs.writeFileSync(file, html, "utf8");
  n += 1;
  console.log("[inject-gallery-hotfix]", path.relative(OUT, file));
}
// copy hotfix to out/scripts
const src = path.join(ROOT, "public", "scripts", "gallery-single-thumb-hotfix.js");
const destDir = path.join(OUT, "scripts");
fs.mkdirSync(destDir, { recursive: true });
fs.copyFileSync(src, path.join(destDir, "gallery-single-thumb-hotfix.js"));
console.log(`[inject-gallery-hotfix] done products=${n}`);
