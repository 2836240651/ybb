/**
 * 将产品按 Product Type 加入对应 Collection（手动系列用 GraphQL 批量添加）
 * 用法: node 11-assign-collections-gql.mjs [--only "Carp Fishing Rig"]
 */
import fs from "fs";
import path from "path";
import { createAuthedPage, closeAuthedPage, ensureLoggedIn } from "./lib/import-helpers.mjs";
import { loadConfig } from "./lib/config.mjs";
import { bootstrapGql, adminGql } from "./lib/shopify-gql.mjs";
import { ROOT } from "./lib/config.mjs";

const cfg = loadConfig();
const only = process.argv.find((a, i) => process.argv[i - 1] === "--only") || "";
const logPath = path.join(ROOT, "output", "shopify", "collection-assign-log.json");
const BATCH = 250;

function arg(name) {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : "";
}

async function fetchProductIdsByType(page, ctx, productType) {
  const q = `query ProductsByType($q: String!, $cursor: String) {
    products(first: 250, query: $q, after: $cursor) {
      edges { node { id } }
      pageInfo { hasNextPage endCursor }
    }
  }`;
  const ids = [];
  let cursor = null;
  const searchQ = `product_type:'${productType.replace(/'/g, "\\'")}'`;
  for (let pageNum = 0; pageNum < 20; pageNum++) {
    const data = await adminGql(page, ctx, q, { q: searchQ, cursor });
    for (const e of data.products.edges) ids.push(e.node.id);
    if (!data.products.pageInfo.hasNextPage) break;
    cursor = data.products.pageInfo.endCursor;
    await page.waitForTimeout(200);
  }
  return ids;
}

async function addProductsToCollection(page, ctx, collectionGid, productIds) {
  const mutation = `mutation collectionAddProducts($id: ID!, $productIds: [ID!]!) {
    collectionAddProducts(id: $id, productIds: $productIds) {
      collection { id title productsCount }
      userErrors { field message }
    }
  }`;
  let added = 0;
  for (let i = 0; i < productIds.length; i += BATCH) {
    const chunk = productIds.slice(i, i + BATCH);
    const res = await adminGql(page, ctx, mutation, { id: collectionGid, productIds: chunk });
    const errs = res?.collectionAddProducts?.userErrors ?? [];
    if (errs.length) throw new Error(errs.map((e) => e.message).join("; "));
    added += chunk.length;
    await page.waitForTimeout(250);
  }
  return added;
}

const entries = Object.entries(cfg.collections ?? {}).filter(([name]) => !only || name === only);
if (!entries.length) {
  console.error("无匹配 collections");
  process.exit(1);
}

console.log(`Collection 归类 | 系列 ${entries.length}`);

const { browser, page, ownsPage, usingCdp } = await createAuthedPage({ preferFresh: true });
const log = { startedAt: new Date().toISOString(), method: "graphql-collectionAddProducts", results: [] };

try {
  await page.goto(`https://admin.shopify.com/store/${cfg.store}/collections`, {
    waitUntil: "domcontentloaded",
    timeout: 120000,
  });
  await ensureLoggedIn(page);
  const ctx = await bootstrapGql(page, cfg.store);

  for (const [name, col] of entries) {
    const item = { collection: name, collectionId: col.collectionId, productTypes: col.matchProductTypes ?? [], status: "pending" };
    log.results.push(item);

    if (!col.collectionId) {
      item.status = "skipped";
      item.error = "无 collectionId";
      continue;
    }

    const gid = `gid://shopify/Collection/${col.collectionId}`;
    const types = col.matchProductTypes ?? [];
    console.log(`\n=== ${name} ===`);

    try {
      const idSet = new Set();
      for (const pt of types) {
        const ids = await fetchProductIdsByType(page, ctx, pt);
        console.log(`  ${pt}: ${ids.length} 个产品`);
        ids.forEach((id) => idSet.add(id));
      }

      const allIds = [...idSet];
      if (!allIds.length) {
        item.status = "empty";
        item.added = 0;
        continue;
      }

      const added = await addProductsToCollection(page, ctx, gid, allIds);
      item.status = "ok";
      item.added = added;
      item.uniqueProducts = allIds.length;
      console.log(`  ✓ 已加入 ${added} 个产品`);
    } catch (e) {
      item.status = "failed";
      item.error = String(e.message || e).slice(0, 400);
      console.warn(`  ✗ ${item.error}`);
    }
  }
} finally {
  log.finishedAt = new Date().toISOString();
  fs.mkdirSync(path.dirname(logPath), { recursive: true });
  fs.writeFileSync(logPath, JSON.stringify(log, null, 2), "utf8");
  await closeAuthedPage({ browser, page, ownsPage, usingCdp });
}

const ok = log.results.filter((r) => r.status === "ok").length;
const failed = log.results.filter((r) => r.status === "failed").length;
console.log(`\n归类完成: ok=${ok} failed=${failed} → ${logPath}`);
