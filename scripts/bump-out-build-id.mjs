#!/usr/bin/env node
/** Bump <!--buildId--> comment in all out/*.html */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "out");
const NEW_ID = process.argv[2] || "imgfix20260706c";

function walk(dir, acc = []) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    if (fs.statSync(p).isDirectory()) walk(p, acc);
    else if (name.endsWith(".html")) acc.push(p);
  }
  return acc;
}

let n = 0;
for (const file of walk(OUT)) {
  let text = fs.readFileSync(file, "utf8");
  const next = text.replace(/<!--[^>]*-->/, `<!--${NEW_ID}-->`);
  if (next !== text) {
    fs.writeFileSync(file, next, "utf8");
    n += 1;
  }
}
console.log(`[bump-build-id] ${NEW_ID} in ${n} html files`);
