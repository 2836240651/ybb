/**
 * Upload deploy artifacts to carp-ybb.com via SiteGround File Manager (browser).
 *
 * Usage:
 *   node scripts/open-siteground-chrome.mjs
 *   node scripts/upload-siteground-browser.mjs --files deploy/ybb-static-export.zip deploy/unzip-export.php
 *   node scripts/upload-siteground-browser.mjs --files deploy/restore-htaccess.php deploy/htaccess.restore --wait-manual
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const ROOT = path.join(__dirname, "..");

function loadPlaywright() {
  const candidates = [
    "playwright",
    path.join("D:", "dev", "独立站上架", "wordpress", "node_modules", "playwright"),
    path.join(ROOT, "node_modules", "playwright"),
  ];
  for (const candidate of candidates) {
    try {
      return require(candidate);
    } catch {
      // try next
    }
  }
  throw new Error(
    "playwright not found. Run: cd D:\\dev\\独立站上架\\wordpress && npm install"
  );
}

const { chromium } = loadPlaywright();

const SECRETS = path.join(ROOT, "secrets.local.json");
const SESSION = path.join(ROOT, "deploy", "siteground-browser-session.json");
const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const CDP_PORT = 9224;

function parseArgs(argv) {
  const files = [];
  let waitManual = false;
  for (let i = 2; i < argv.length; i += 1) {
    if (argv[i] === "--files") {
      while (argv[i + 1] && !argv[i + 1].startsWith("--")) {
        files.push(path.resolve(ROOT, argv[++i]));
      }
      continue;
    }
    if (argv[i] === "--wait-manual") waitManual = true;
  }
  return { files, waitManual };
}

function loadJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

async function restoreSession(page) {
  if (!fs.existsSync(SESSION)) return;
  const session = loadJson(SESSION);
  await page.goto("https://my.siteground.com/", { waitUntil: "domcontentloaded" });
  await page.evaluate((data) => {
    for (const [k, v] of Object.entries(data.localStorage || {})) {
      try {
        localStorage.setItem(k, v);
      } catch {}
    }
    for (const [k, v] of Object.entries(data.sessionStorage || {})) {
      try {
        sessionStorage.setItem(k, v);
      } catch {}
    }
    if (data.documentCookie) {
      document.cookie = `${data.documentCookie}; path=/; domain=.siteground.com; secure; samesite=lax`;
    }
  }, session);
}

async function connectBrowser() {
  try {
    return await chromium.connectOverCDP(`http://127.0.0.1:${CDP_PORT}`);
  } catch {
    console.error(
      "[siteground] Chrome CDP not available. Run: node scripts/open-siteground-chrome.mjs"
    );
    process.exit(1);
  }
}

async function waitForLogin(page, timeoutMs = 180_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const url = page.url();
    if (url.includes("tools.siteground.com/filemanager")) return true;
    if (url.includes("my.siteground.com") && !url.includes("login.siteground.com")) {
      return true;
    }
    await page.waitForTimeout(3000);
  }
  return false;
}

async function tryUpload(page, files) {
  const selectors = [
    'input[type="file"]',
    'input[accept]',
    '[data-testid*="upload" i]',
    'button:has-text("Upload")',
    'a:has-text("Upload")',
  ];

  for (const selector of selectors) {
    const locator = page.locator(selector).first();
    if (!(await locator.count())) continue;
    try {
      if (selector.includes("input")) {
        await locator.setInputFiles(files);
        console.log(`[siteground] uploaded via ${selector}`);
        await page.waitForTimeout(5000);
        return true;
      }
      const [chooser] = await Promise.all([
        page.waitForEvent("filechooser", { timeout: 8000 }),
        locator.click(),
      ]);
      await chooser.setFiles(files);
      console.log(`[siteground] uploaded via file chooser (${selector})`);
      await page.waitForTimeout(5000);
      return true;
    } catch {
      // try next selector
    }
  }
  return false;
}

const { files, waitManual } = parseArgs(process.argv);
if (!files.length) {
  console.error("Usage: node scripts/upload-siteground-browser.mjs --files <path> [...]");
  process.exit(1);
}
for (const file of files) {
  if (!fs.existsSync(file)) {
    console.error(`[siteground] missing file: ${file}`);
    process.exit(1);
  }
}

const secrets = loadJson(SECRETS);
const siteId = secrets?.deploy?.siteToolsSiteId;
if (!siteId) {
  console.error("[siteground] deploy.siteToolsSiteId missing in secrets.local.json");
  process.exit(1);
}

const fileManagerUrl = `https://tools.siteground.com/filemanager?siteId=${siteId}`;
const browser = await connectBrowser();
const context = browser.contexts()[0];
const page = context.pages().find((p) => !p.isClosed()) || (await context.newPage());

await restoreSession(page);
await page.goto(fileManagerUrl, { waitUntil: "domcontentloaded" });
console.log("[siteground] current:", page.url());

if (page.url().includes("login.siteground.com")) {
  console.log("[siteground] login required — complete login + captcha in Chrome, waiting...");
  const ok = await waitForLogin(page);
  if (!ok) {
    console.error("[siteground] login timeout");
    process.exit(1);
  }
  if (!page.url().includes("filemanager")) {
    await page.goto(fileManagerUrl, { waitUntil: "domcontentloaded" });
  }
}

let uploaded = await tryUpload(page, files);
if (!uploaded && waitManual) {
  console.log(
    "[siteground] auto-upload not detected. Upload manually in File Manager:\n" +
      files.map((f) => `  - ${path.basename(f)}`).join("\n")
  );
  console.log("[siteground] Press Enter in this terminal when upload is done...");
  process.stdin.resume();
  await new Promise((resolve) => process.stdin.once("data", resolve));
  uploaded = true;
}

if (!uploaded) {
  console.error("[siteground] upload failed — rerun with --wait-manual");
  process.exit(1);
}

console.log("[siteground] upload step complete");
process.exit(0);
