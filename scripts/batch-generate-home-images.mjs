/**
 * Batch-generate homepage images via GRSAI (config from D:\dev\workspace).
 *
 * Usage:
 *   node scripts/batch-generate-home-images.mjs
 *   node scripts/batch-generate-home-images.mjs --limit 3
 *   node scripts/batch-generate-home-images.mjs --only hero-factory-catalog,product-stand-wrench
 *   node scripts/batch-generate-home-images.mjs --dry-run
 *   node scripts/batch-generate-home-images.mjs --concurrency 1
 *   node scripts/batch-generate-home-images.mjs --skip-existing
 *   node scripts/batch-generate-home-images.mjs --retry-failed
 *   node scripts/batch-generate-home-images.mjs --retry-stale
 *   node scripts/batch-generate-home-images.mjs --force
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const MANIFEST = path.join(__dirname, "home-image-prompts.json");
const GRSAI_LIB = path.resolve(
  "D:/dev/workspace/scripts/product-image-normalize/lib/grsai.mjs"
);

const { loadGrsaiConfig, downloadImage } = await import(
  pathToFileURL(GRSAI_LIB).href
);

function arg(name, fallback) {
  const i = process.argv.indexOf(name);
  if (i === -1) return fallback;
  const v = process.argv[i + 1];
  return v === undefined ? true : v;
}

const dryRun = process.argv.includes("--dry-run");
const force = process.argv.includes("--force");
const skipExisting = process.argv.includes("--skip-existing") && !force;
const retryFailed = process.argv.includes("--retry-failed");
const retryStale = process.argv.includes("--retry-stale");
const limit = Number(arg("--limit", "0")) || 0;
const only = arg("--only", "");
const concurrency = Number(arg("--concurrency", "1")) || 1;
const pollTimeoutMs = Number(arg("--poll-timeout-ms", "180000")) || 180_000;
const configPath =
  arg("--config", "") ||
  JSON.parse(fs.readFileSync(MANIFEST, "utf8")).meta?.config;

const reportPath = path.join(ROOT, "scripts", "home-image-gen-report.json");
const manifest = JSON.parse(fs.readFileSync(MANIFEST, "utf8"));
let items = manifest.items;

function isStaleOutput(item) {
  const dest = path.join(ROOT, item.output);
  if (!fs.existsSync(dest)) return true;
  const manifestMtime = fs.statSync(MANIFEST).mtimeMs;
  return fs.statSync(dest).mtimeMs < manifestMtime;
}

if (retryFailed && fs.existsSync(reportPath)) {
  const prev = JSON.parse(fs.readFileSync(reportPath, "utf8"));
  const failedIds = new Set((prev.failed || []).map((x) => x.id));
  if (failedIds.size > 0) {
    items = items.filter((x) => failedIds.has(x.id));
    console.log(`Retry failed: ${items.length} items from prior report`);
  } else {
    console.log("Prior report has no failures — use --retry-stale instead");
  }
}
if (retryStale) {
  const before = items.length;
  items = items.filter((x) => isStaleOutput(x));
  console.log(`Retry stale: ${items.length} of ${before} items older than manifest`);
}
if (only) {
  const ids = new Set(only.split(",").map((s) => s.trim()).filter(Boolean));
  items = items.filter((x) => ids.has(x.id));
}
if (skipExisting) {
  const before = items.length;
  items = items.filter((x) => !fs.existsSync(path.join(ROOT, x.output)));
  console.log(`Skip existing: ${before - items.length} already on disk`);
}
if (limit > 0) items = items.slice(0, limit);

const report = {
  startedAt: new Date().toISOString(),
  total: items.length,
  ok: [],
  failed: [],
};

async function httpJson(method, url, apiKey, body) {
  const headers = { Authorization: `Bearer ${apiKey}`, Accept: "application/json" };
  const init = { method, headers };
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(body);
  }
  const res = await fetch(url, init);
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  return { status: res.status, ok: res.ok, json, text };
}

function normalizeAspectRatio(w, h) {
  const max = 2048;
  let nw = w;
  let nh = h;
  if (nw > max || nh > max) {
    const scale = max / Math.max(nw, nh);
    nw = Math.round(nw * scale);
    nh = Math.round(nh * scale);
  }
  const snap = (n) => Math.max(256, Math.round(n / 64) * 64);
  return `${snap(nw)}x${snap(nh)}`;
}

async function pollResult(base, apiKey, taskId) {
  const deadline = Date.now() + pollTimeoutMs;
  while (Date.now() < deadline) {
    const r = await httpJson(
      "GET",
      `${base}/api/result?id=${encodeURIComponent(taskId)}`,
      apiKey
    );
    const data = r.json || {};
    const status = String(data.status || "").toLowerCase();
    if (status === "succeeded") {
      const urls = (data.results || [])
        .map((x) => x.url)
        .filter((u) => typeof u === "string" && u.trim());
      if (!urls.length) throw new Error("grsai succeeded but no image URL");
      return urls[0];
    }
    if (status === "failed" || status === "violation") {
      throw new Error(data.error || `grsai failed: ${status}`);
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error(`grsai poll timeout id=${taskId}`);
}

async function generateTextImage(config, prompt, width, height) {
  const body = {
    model: config.model,
    prompt,
    images: [],
    aspectRatio: normalizeAspectRatio(width, height),
    replyType: "async",
  };
  let lastErr;
  for (let attempt = 0; attempt < 6; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 6000 * attempt));
    try {
      const r = await httpJson(
        "POST",
        `${config.base}/api/generate`,
        config.apiKey,
        body
      );
      const data = r.json || {};
      if (!r.ok) throw new Error(data.error || data.message || `HTTP ${r.status}`);
      const status = String(data.status || "").toLowerCase();
      if (status === "succeeded" && data.results?.[0]?.url) {
        return data.results[0].url;
      }
      if (!data.id) throw new Error(data.error || "no task id");
      return pollResult(config.base, config.apiKey, data.id);
    } catch (err) {
      lastErr = err;
      const msg = err?.message || String(err);
      if (/load|busy|429|rate|超时|fetch failed/i.test(msg) && attempt < 5) continue;
      throw err;
    }
  }
  throw lastErr || new Error("generate failed");
}

async function saveAsWebp(url, destPath, width, height) {
  const tmp = destPath + ".tmp";
  await downloadImage(url, tmp);
  const pipeline = sharp(tmp).resize(width, height, {
    fit: "cover",
    position: "centre",
  });
  if (destPath.endsWith(".webp")) {
    await pipeline.webp({ quality: 85 }).toFile(destPath);
  } else {
    await pipeline.jpeg({ quality: 90 }).toFile(destPath);
  }
  fs.unlinkSync(tmp);
}

function buildFullPrompt(item, meta) {
  const parts = [
    item.prompt,
    meta?.photographyBaseline,
    meta?.audience ? `TARGET AUDIENCE: ${meta.audience}` : "",
  ].filter(Boolean);
  return parts.join(" | ");
}

async function processOne(config, item, meta) {
  const dest = path.join(ROOT, item.output);
  const fullPrompt = buildFullPrompt(item, meta);
  const t0 = Date.now();
  console.log(`\n▶ ${item.id}${item.title ? ` — ${item.title}` : ""}`);
  console.log(`  → ${item.output}`);
  console.log(`  prompt chars: ${fullPrompt.length}`);
  if (dryRun) {
    console.log(`  ---\n${fullPrompt.slice(0, 500)}…\n---`);
    return { id: item.id, status: "dry-run", promptChars: fullPrompt.length };
  }
  const url = await generateTextImage(
    config,
    fullPrompt,
    item.width,
    item.height
  );
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  await saveAsWebp(url, dest, item.width, item.height);
  const sec = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`  ✓ done in ${sec}s`);
  return { id: item.id, output: item.output, seconds: Number(sec) };
}

async function mapPool(list, worker, n) {
  const results = [];
  if (n <= 1) {
    for (let i = 0; i < list.length; i++) {
      results[i] = await worker(list[i], i);
      if (i < list.length - 1) await new Promise((r) => setTimeout(r, 2000));
    }
    return results;
  }
  let idx = 0;
  async function run() {
    while (idx < list.length) {
      const i = idx++;
      results[i] = await worker(list[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(n, list.length) }, run));
  return results;
}

console.log(`Manifest: ${items.length} images`);
console.log(`Config: ${configPath}`);
console.log(`Concurrency: ${concurrency}`);
if (dryRun) console.log("DRY RUN — no API calls");

const config = dryRun ? null : loadGrsaiConfig(configPath);

const results = await mapPool(
  items,
  async (item) => {
    try {
      const r = await processOne(config, item, manifest.meta);
      report.ok.push(r);
      return r;
    } catch (err) {
      const msg = err?.message || String(err);
      console.error(`  ✗ ${item.id}: ${msg}`);
      report.failed.push({ id: item.id, error: msg });
      return null;
    }
  },
  concurrency
);

report.finishedAt = new Date().toISOString();
report.summary = {
  ok: report.ok.length,
  failed: report.failed.length,
  skipped: report.skipped?.length ?? 0,
};
// Merge with prior failures so --retry-failed keeps working across runs
if (fs.existsSync(reportPath) && (retryFailed || retryStale)) {
  try {
    const prev = JSON.parse(fs.readFileSync(reportPath, "utf8"));
    const okIds = new Set(report.ok.map((x) => x.id));
    const mergedFailed = [
      ...report.failed,
      ...(prev.failed || []).filter((x) => !okIds.has(x.id)),
    ];
    const seen = new Set();
    report.failed = mergedFailed.filter((x) => {
      if (seen.has(x.id) || okIds.has(x.id)) return false;
      seen.add(x.id);
      return true;
    });
    report.summary.failed = report.failed.length;
  } catch {
    /* ignore */
  }
}
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
console.log(`\nReport: ${reportPath}`);
console.log(`Done: ${report.ok.length} ok, ${report.failed.length} failed`);

if (report.failed.length) process.exit(1);
