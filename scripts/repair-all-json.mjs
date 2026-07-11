#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function repairLine(line) {
  let s = line.replace(/\uFFFD/g, "");
  if (/^\s*"[^"]*":/.test(s) && s.includes("?") && !/"\s*,?\s*$/.test(s.trim())) {
    if (s.trim().endsWith("?,") || s.trim().endsWith("?")) {
      s = s.replace(/\?\s*,?\s*$/, '",');
    }
  }
  if (/^\s*"[^"]*"\s*$/.test(s) && s.includes("?")) {
    s = s.replace(/\?\s*$/, '",');
  }
  return s;
}

function repairJsonText(text) {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const out = [];
  for (const line of lines) {
    if (/^\s*"[?\uFFFD]/.test(line) && line.includes(":")) {
      continue;
    }
    out.push(repairLine(line));
  }
  return out.join("\n");
}

function walk(dir, files = []) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    if (fs.statSync(p).isDirectory()) walk(p, files);
    else if (name.endsWith(".json")) files.push(p);
  }
  return files;
}

const files = walk(path.join(root, "lib"));
let fixed = 0;
for (const file of files) {
  try {
    JSON.parse(fs.readFileSync(file, "utf8"));
    continue;
  } catch {
    // repair
  }
  let text = fs.readFileSync(file, "utf8");
  for (let i = 0; i < 5; i++) {
    text = repairJsonText(text);
    try {
      JSON.parse(text);
      fs.writeFileSync(file, text.endsWith("\n") ? text : text + "\n", "utf8");
      console.log("fixed", path.relative(root, file));
      fixed++;
      break;
    } catch (e) {
      if (i === 4) console.error("still bad", path.relative(root, file), e.message.split("\n")[0]);
    }
  }
}
console.log("total fixed", fixed);
