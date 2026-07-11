#!/usr/bin/env node
/** Inject collection list image hotfix into out/collections/*.html + out/index.html */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "out");
const TAG =
  '<script src="/scripts/collection-list-image-hotfix.js" defer></script>';
const SRC = path.join(ROOT, "public", "scripts", "collection-list-image-hotfix.js");
const DEST_DIR = path.join(OUT, "scripts");
const DEST = path.join(DEST_DIR, "collection-list-image-hotfix.js");

const targets = [
  path.join(OUT, "index.html"),
  ...fs
    .readdirSync(path.join(OUT, "collections"))
    .filter((n) => n.endsWith(".html"))
    .map((n) => path.join(OUT, "collections", n)),
];

fs.mkdirSync(DEST_DIR, { recursive: true });
fs.copyFileSync(SRC, DEST);

let n = 0;
for (const file of targets) {
  if (!fs.existsSync(file)) continue;
  let html = fs.readFileSync(file, "utf8");
  if (html.includes("collection-list-image-hotfix.js")) continue;
  html = html.replace("</body>", `${TAG}</body>`);
  fs.writeFileSync(file, html, "utf8");
  n += 1;
  console.log("[inject-collection-image-hotfix]", path.relative(OUT, file));
}
console.log(`[inject-collection-image-hotfix] done files=${n}`);
