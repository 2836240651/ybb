#!/usr/bin/env node
/**
 * Full pipeline: 产品表单.xlsx -> WooCommerce -> static frontend -> deploy
 *
 * Usage:
 *   node scripts/run-full-product-pipeline.mjs
 *   node scripts/run-full-product-pipeline.mjs --dry-run-woo
 *   node scripts/run-full-product-pipeline.mjs --skip-images --skip-deploy
 */
import { spawnSync } from "child_process";
import { existsSync } from "fs";
import { homedir } from "os";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const val = (f, d) => {
  const i = args.indexOf(f);
  return i >= 0 ? args[i + 1] : d;
};

const xlsx = val("--xlsx", join(homedir(), "Desktop", "产品表单.xlsx"));
const imageDir = val("--image-dir", join(homedir(), "Pictures", "excel表单图"));
const siteUrl = val("--site", "https://carp-ybb.com");
const migrateKey = val("--key", "ybb-migrate-20260624");
const skipImages = has("--skip-images");
const skipWoo = has("--skip-woo");
const skipDeploy = has("--skip-deploy");
const dryRunWoo = has("--dry-run-woo");

function run(cmd, cmdArgs, label) {
  console.log(`\n=== ${label} ===`);
  console.log(`> ${cmd} ${cmdArgs.join(" ")}`);
  const res = spawnSync(cmd, cmdArgs, { cwd: ROOT, stdio: "inherit", shell: true });
  if (res.status !== 0) {
    throw new Error(`${label} failed (exit ${res.status})`);
  }
}

function runSoft(cmd, cmdArgs, label) {
  console.log(`\n=== ${label} (soft) ===`);
  const res = spawnSync(cmd, cmdArgs, { cwd: ROOT, stdio: "inherit", shell: true });
  return res.status ?? 1;
}

async function wc(pathAndQuery) {
  const sep = pathAndQuery.includes("?") ? "&" : "?";
  const url = `${siteUrl}/${pathAndQuery}${sep}nocache=1`;
  console.log(`[wc] GET ${url}`);
  const res = await fetch(url);
  const text = await res.text();
  console.log(text);
  if (!res.ok) throw new Error(`WC HTTP ${res.status}: ${url}`);
  return JSON.parse(text);
}

async function main() {
  if (!existsSync(xlsx)) throw new Error(`Excel not found: ${xlsx}`);

  run("py", ["scripts/parse-product-form.py", "--xlsx", xlsx], "Step 1 parse form");

  if (!skipImages) {
    const code = runSoft(
      "py",
      ["scripts/extract-product-images.py", "--xlsx", xlsx, "--output", imageDir],
      "Step 2 extract images"
    );
    if (code !== 0) console.warn("[warn] extract-product-images had missing media");

    const manifestCode = runSoft(
      "node",
      ["scripts/build-assets-manifest.mjs", "--image-dir", imageDir],
      "Step 3 build assets-manifest"
    );
    if (manifestCode > 2) throw new Error("build-assets-manifest failed");
  }

  console.log(
    "\n[pipeline] Step 4 skipped — run sync-from-wp.mjs AFTER Woo Playwright import (Woo-first)"
  );

  if (!skipImages) {
    run("node", ["scripts/export-product-images.mjs", "--all"], "Step 5 export webp");
    runSoft("node", ["scripts/audit-product-images.mjs", "--site", siteUrl], "Step 6 audit images");
  }

  if (!skipWoo) {
    run("py", ["scripts/upload-product-import.py"], "Step 7 upload import bundle");
    if (dryRunWoo) {
      await wc(`wc-cleanup-products.php?key=${migrateKey}&dry_run=1`);
      await wc(`sync-wc-products.php?key=${migrateKey}&dry_run=1`);
      console.log("[pipeline] dry-run-woo complete");
    } else {
      await wc(`wc-cleanup-products.php?key=${migrateKey}&dry_run=1`);
      await wc(`sync-wc-products.php?key=${migrateKey}&dry_run=1`);
      await wc(`wc-cleanup-products.php?key=${migrateKey}`);
      await wc(`sync-wc-products.php?key=${migrateKey}`);
      await wc(`sync-wc-hot-products.php?key=${migrateKey}`);
      await wc(`wc-cleanup-migration.php?key=${migrateKey}`);
    }
  }

  run("node", ["scripts/sync-from-wp.mjs", "--site", siteUrl], "Step 8 sync wcIds");

  const buildArgs = skipDeploy
    ? ["-ExecutionPolicy", "Bypass", "-File", "scripts/build-static.ps1", "-SkipSync", "-SkipDeploy"]
    : ["-ExecutionPolicy", "Bypass", "-File", "scripts/build-static.ps1", "-SkipSync"];
  run("powershell", buildArgs, "Step 9 build + deploy");

  console.log("\n[pipeline] DONE");
  console.log(`Verify: ${siteUrl}/ | ${siteUrl}/cart/ | ${siteUrl}/checkout/ | ${siteUrl}/my-account/`);
}

main().catch((err) => {
  console.error("[pipeline] FAIL:", err.message);
  process.exit(1);
});
