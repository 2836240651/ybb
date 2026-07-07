/**
 * 独立站上货表单：GraphQL 上传 → 相册挂图 → 按 imageFile 精确绑定变体 SKU 图
 *
 * 用法:
 *   node attach-listing-images-gql.mjs --manifest output/shopify/独立站上货表单(8)/manifest.json
 *   node attach-listing-images-gql.mjs --manifest ... --force-variants   # 强制重绑变体图
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createAuthedPage, closeAuthedPage, ensureLoggedIn } from "./lib/import-helpers.mjs";
import { loadConfig } from "./lib/config.mjs";
import { bootstrapGql, adminGql } from "./lib/shopify-gql.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

function arg(name, fallback = "") {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const manifestPath = path.resolve(ROOT, arg("--manifest", ""));
const forceVariants = process.argv.includes("--force-variants");

if (!manifestPath || !fs.existsSync(manifestPath)) {
  console.error("用法: node attach-listing-images-gql.mjs --manifest <manifest.json> [--force-variants]");
  process.exit(1);
}

const imagesDir = path.join(path.dirname(manifestPath), "images");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const products = (manifest.sheets ?? []).flatMap((s) => s.products ?? []);

const MEDIA_ALT_PREFIX = "listing-file:";

function mimeFor(file) {
  const ext = path.extname(file).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  return "image/jpeg";
}

function readFiles(relNames) {
  return relNames
    .map((f) => {
      const fp = path.join(imagesDir, f);
      if (!fs.existsSync(fp)) return null;
      const buf = fs.readFileSync(fp);
      return {
        rel: f,
        name: path.basename(fp),
        mime: mimeFor(fp),
        base64: buf.toString("base64"),
        size: buf.length,
      };
    })
    .filter(Boolean);
}

const cfg = loadConfig();
const { browser, page, ownsPage, usingCdp } = await createAuthedPage({ preferCdp: true });

async function stagedUpload(gqlCtx, files) {
  if (!files.length) return [];
  const mutation = `
    mutation stagedUploadsCreate($input: [StagedUploadInput!]!) {
      stagedUploadsCreate(input: $input) {
        stagedTargets { url resourceUrl parameters { name value } }
        userErrors { field message }
      }
    }`;
  const res = await adminGql(page, gqlCtx, mutation, {
    input: files.map((f) => ({
      filename: f.name,
      mimeType: f.mime,
      resource: "PRODUCT_IMAGE",
      fileSize: String(f.size),
      httpMethod: "POST",
    })),
  });
  const errs = res?.stagedUploadsCreate?.userErrors ?? [];
  if (errs.length) throw new Error(errs.map((e) => e.message).join("; "));
  const targets = res?.stagedUploadsCreate?.stagedTargets ?? [];
  const resourceUrls = [];
  for (let i = 0; i < targets.length; i++) {
    const uploaded = await page.evaluate(
      async ({ target, base64, mime, filename }) => {
        const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
        const blob = new Blob([bytes], { type: mime });
        const form = new FormData();
        for (const p of target.parameters) form.append(p.name, p.value);
        form.append("file", blob, filename);
        const res = await fetch(target.url, { method: "POST", body: form });
        if (!res.ok) return { ok: false, status: res.status, text: await res.text() };
        return { ok: true, resourceUrl: target.resourceUrl };
      },
      { target: targets[i], base64: files[i].base64, mime: files[i].mime, filename: files[i].name }
    );
    if (!uploaded.ok) throw new Error(`上传失败 ${files[i].name}: ${uploaded.status}`);
    resourceUrls.push(uploaded.resourceUrl);
    console.log("  ↑", files[i].name);
  }
  return resourceUrls;
}

async function createMedia(gqlCtx, productId, files, resourceUrls) {
  if (!files.length) return [];
  const mutation = `
    mutation productCreateMedia($productId: ID!, $media: [CreateMediaInput!]!) {
      productCreateMedia(productId: $productId, media: $media) {
        media {
          id
          alt
          ... on MediaImage { status image { url } }
        }
        mediaUserErrors { field message }
      }
    }`;
  const res = await adminGql(page, gqlCtx, mutation, {
    productId,
    media: resourceUrls.map((url, i) => ({
      originalSource: url,
      alt: `${MEDIA_ALT_PREFIX}${files[i].rel}`,
      mediaContentType: "IMAGE",
    })),
  });
  const errs = res?.productCreateMedia?.mediaUserErrors ?? [];
  if (errs.length) throw new Error(errs.map((e) => e.message).join("; "));
  return res?.productCreateMedia?.media ?? [];
}

const PRODUCT_Q = `
  query ProductByHandle($q: String!) {
    products(first: 1, query: $q) {
      edges {
        node {
          id handle
          media(first: 50) {
            edges {
              node {
                id alt
                ... on MediaImage { status image { url } }
              }
            }
          }
          variants(first: 50) {
            edges { node { id sku title image { id url } } }
          }
        }
      }
    }
  }`;

function stemOf(rel) {
  return path.basename(rel, path.extname(rel)).toLowerCase().replace(/_/g, "-");
}

function mediaMapsFromNode(node, relNames) {
  const byRel = new Map();
  const urlByRel = new Map();
  for (const e of node?.media?.edges ?? []) {
    const alt = e.node?.alt ?? "";
    const url = (e.node?.image?.url ?? "").toLowerCase();
    if (alt.startsWith(MEDIA_ALT_PREFIX)) {
      const rel = alt.slice(MEDIA_ALT_PREFIX.length);
      if (rel && e.node?.id) {
        byRel.set(rel, e.node.id);
        urlByRel.set(rel, url);
      }
      continue;
    }
    for (const rel of relNames) {
      if (byRel.has(rel)) continue;
      const stem = stemOf(rel);
      if (stem && url.includes(stem)) {
        byRel.set(rel, e.node.id);
        urlByRel.set(rel, url);
      }
    }
  }
  return { byRel, urlByRel };
}

async function waitMediaReady(gqlCtx, handle, relNames, maxMs = 90000) {
  const need = new Set(relNames);
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    const data = await adminGql(page, gqlCtx, PRODUCT_Q, { q: `handle:${handle}` });
    const node = data?.products?.edges?.[0]?.node;
    const { byRel } = mediaMapsFromNode(node, [...need]);
    const ready = [...need].every((rel) => byRel.has(rel));
    const statuses = (node?.media?.edges ?? [])
      .filter((e) => {
        const alt = e.node?.alt ?? "";
        return alt.startsWith(MEDIA_ALT_PREFIX) && need.has(alt.slice(MEDIA_ALT_PREFIX.length));
      })
      .map((e) => e.node?.status);
    if (ready && statuses.every((s) => !s || s === "READY")) return byRel;
    await page.waitForTimeout(2500);
  }
  throw new Error(`媒体处理超时: ${[...need].join(", ")}`);
}

async function ensureMediaForFiles(gqlCtx, productId, handle, files, existingMap) {
  const missing = files.filter((f) => !existingMap.has(f.rel));
  if (!missing.length) return existingMap;
  console.log("  补传媒体:", missing.map((f) => f.name).join(", "));
  const urls = await stagedUpload(gqlCtx, missing);
  await createMedia(gqlCtx, productId, missing, urls);
  return waitMediaReady(gqlCtx, handle, [...existingMap.keys(), ...missing.map((f) => f.rel)]);
}

async function bulkAssignVariantMedia(gqlCtx, productId, updates) {
  if (!updates.length) return;
  const mutation = `
    mutation productVariantsBulkUpdate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
      productVariantsBulkUpdate(productId: $productId, variants: $variants) {
        productVariants { id sku image { url } }
        userErrors { field message }
      }
    }`;
  const res = await adminGql(page, gqlCtx, mutation, {
    productId,
    variants: updates.map(({ variantId, mediaId }) => ({ id: variantId, mediaId })),
  });
  const errs = res?.productVariantsBulkUpdate?.userErrors ?? [];
  if (errs.length) throw new Error(errs.map((e) => e.message).join("; "));
}

try {
  await page.goto(`https://admin.shopify.com/store/${cfg.store}/products`, {
    waitUntil: "domcontentloaded",
    timeout: 120000,
  });
  await page.waitForTimeout(4000);
  await ensureLoggedIn(page);
  const gqlCtx = await bootstrapGql(page, cfg.store, { waitMs: 45000 });

  for (const product of products) {
    console.log(`\n=== ${product.handle} ===`);
    const galleryFiles = readFiles(product.galleryFiles ?? []);
    const variantFileRels = [...new Set((product.variants ?? []).map((v) => v.imageFile).filter(Boolean))];
    const variantFiles = readFiles(variantFileRels);
    const allRels = [...galleryFiles.map((f) => f.rel), ...variantFileRels];

    const data = await adminGql(page, gqlCtx, PRODUCT_Q, { q: `handle:${product.handle}` });
    const node = data?.products?.edges?.[0]?.node;
    if (!node?.id) {
      console.warn("未找到产品，跳过");
      continue;
    }

    let { byRel: mediaByRel } = mediaMapsFromNode(node, allRels);
    const galleryMissing = galleryFiles.filter((f) => !mediaByRel.has(f.rel));
    if (galleryMissing.length) {
      console.log("上传相册", galleryMissing.length, "张…");
      const urls = await stagedUpload(gqlCtx, galleryMissing);
      await createMedia(gqlCtx, node.id, galleryMissing, urls);
      mediaByRel = await waitMediaReady(
        gqlCtx,
        product.handle,
        [...mediaByRel.keys(), ...galleryMissing.map((f) => f.rel)]
      );
      console.log("✓ 相册就绪:", galleryFiles.length);
    } else {
      console.log("相册已有", galleryFiles.length, "张");
    }

    mediaByRel = await ensureMediaForFiles(gqlCtx, node.id, product.handle, variantFiles, mediaByRel);

    const data2 = await adminGql(page, gqlCtx, PRODUCT_Q, { q: `handle:${product.handle}` });
    const node2 = data2?.products?.edges?.[0]?.node;
    const maps2 = mediaMapsFromNode(node2, allRels);
    mediaByRel = maps2.byRel;

    const toAssign = [];
    for (const v of product.variants ?? []) {
      const variantNode = (node2?.variants?.edges ?? []).find((e) => e.node.sku === v.sku)?.node;
      if (!variantNode || !v.imageFile) continue;
      const targetMediaId = mediaByRel.get(v.imageFile);
      if (!targetMediaId) {
        console.warn("  无 mediaId:", v.sku, v.imageFile);
        continue;
      }
      const targetUrl = maps2.urlByRel.get(v.imageFile) ?? "";
      const currentUrl = (variantNode.image?.url ?? "").toLowerCase();
      if (!forceVariants && currentUrl && targetUrl && currentUrl === targetUrl) continue;
      toAssign.push({ variantId: variantNode.id, mediaId: targetMediaId, sku: v.sku, file: v.imageFile });
    }

    if (toAssign.length) {
      await bulkAssignVariantMedia(gqlCtx, node2.id, toAssign);
      for (const item of toAssign) {
        console.log(`  ✓ ${item.sku} ← ${item.file}`);
      }
      console.log("✓ 变体挂图:", toAssign.length);
    } else {
      console.log("变体图已对齐，跳过");
    }
  }
} finally {
  await closeAuthedPage({ browser, page, ownsPage, usingCdp });
}

console.log("\n全部产品图片处理完成");
