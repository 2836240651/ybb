#!/usr/bin/env node
/**
 * Repair mojibake / broken UTF-8 in ybb-site source (one-off).
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

const lineFixes = {
  "components/product/ProductContentTabs.tsx": {
    159: '                  {open ? "\u2212" : "+"}',
  },
  "components/layout/MobileNavDrawer.tsx": {
    109: '                          {isOpen ? "\u2212" : "+"}',
  },
  "components/product/ProductReviewsSummary.tsx": {
    32: '            {reviewCount > 0 ? averageRating.toFixed(1) : "\u2014"}',
    54: '              <span className="text-foreground/60">{stars} \u2605</span>',
  },
  "components/product/WriteReviewModal.tsx": {
    82: '            <span aria-hidden>{"\u00d7"}</span>',
  },
  "components/product/ProductQuickViewModal.tsx": {
    73: '          <span aria-hidden>{"\u00d7"}</span>',
  },
  "components/blog/BlogIndexView.tsx": {
    110: '                    <span className="text-sm font-medium mt-2">Read more \u2192</span>',
  },
  "lib/i18n/country.ts": {
    5: '  { id: "eu", flag: "\uD83C\uDDEA\uD83C\uDDFA", label: "European Union", currency: "EUR", symbol: "\u20ac" },',
  },
  "lib/navigation/HardNavCapture.tsx": {
    18: '    body.includes("\u8be5\u7c7b\u76ee\u6682\u65e0\u5546\u54c1") ||',
  },
  "lib/site-manager/wholesale-nav.ts": {
    38: '          ja: "\u3059\u3079\u3066\u306e\u5546\u54c1\u3092\u898b\u308b",',
  },
  "lib/i18n/locales.ts": {
    15: '  zh: "\u7b80\u4f53\u4e2d\u6587",',
    16: '  en: "English",',
    17: '  ja: "\u65e5\u672c\u8a9e",',
    21: '  zh: "\u4e2d\u6587",',
    22: '  en: "English",',
    23: '  ja: "\u65e5\u672c\u8a9e",',
  },
  "components/layout/MobileDock.tsx": {
    29: '        icon: "\ud83c\udfe0",',
    34: '      { labelKey: "dock.menu", icon: "\u2630", action: "menu" },',
    35: '      { labelKey: "dock.search", icon: "\ud83d\udd0d", action: "search" },',
    38: '        icon: "\ud83d\udecd\ufe0f",',
    46: '        icon: "\ud83d\udc64",',
  },
};

const textReplacements = [
  ["lib/collection-filters.ts", /Aâ€"Z/g, "A-Z"],
  ["lib/collection-filters.ts", /Zâ€"A/g, "Z-A"],
  ["lib/collection-filters.ts", /£25 â€\?£50/g, "£25 - £50"],
  ["lib/collection-filters.ts", /Under Â£25/g, "Under £25"],
  ["lib/collection-filters.ts", /Over Â£50/g, "Over £50"],
  ["components/icons/IconEye.tsx", /â€\?/g, "-"],
  ["lib/motion/scroll-reveal.ts", /â€\?/g, "-"],
];

function fixLines(rel, replacements) {
  const file = path.join(root, rel);
  const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
  for (const [idx, text] of Object.entries(replacements)) {
    lines[Number(idx)] = text;
  }
  fs.writeFileSync(file, lines.join("\n") + "\n", "utf8");
  console.log("fixed lines", rel);
}

for (const [rel, reps] of Object.entries(lineFixes)) {
  fixLines(rel, reps);
}

for (const [rel, pattern, repl] of textReplacements) {
  const file = path.join(root, rel);
  let text = fs.readFileSync(file, "utf8");
  const next = text.replace(pattern, repl);
  if (next !== text) {
    fs.writeFileSync(file, next, "utf8");
    console.log("fixed text", rel);
  }
}

function stripInvalidUtf8(rel) {
  const file = path.join(root, rel);
  if (!fs.existsSync(file)) return;
  const buf = fs.readFileSync(file);
  const cleaned = Buffer.from(
    buf
      .toString("utf8")
      .replace(/\uFFFD/g, "")
      .replace(/â€\?/g, "-")
      .replace(/â€"/g, "-")
      .replace(/Â£/g, "£")
  );
  fs.writeFileSync(file, cleaned, "utf8");
  console.log("cleaned", rel);
}

for (const rel of [
  "lib/motion/scroll-reveal.ts",
  "lib/data/legal-routes.ts",
]) {
  stripInvalidUtf8(rel);
}

function validateJsonDir(dir) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    if (fs.statSync(p).isDirectory()) {
      validateJsonDir(p);
      continue;
    }
    if (!name.endsWith(".json")) continue;
    const rel = path.relative(root, p).replace(/\\/g, "/");
    try {
      const raw = fs.readFileSync(p, "utf8");
      JSON.parse(raw);
    } catch (e) {
      const fixed = fs
        .readFileSync(p, "utf8")
        .replace(/\uFFFD/g, "")
        .replace(/â€\?/g, "-")
        .replace(/â€"/g, "-");
      fs.writeFileSync(p, fixed, "utf8");
      JSON.parse(fs.readFileSync(p, "utf8"));
      console.log("fixed json", rel);
    }
  }
}

validateJsonDir(path.join(root, "lib/data"));
