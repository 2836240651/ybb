# Shopify 导入与图片

## 产品导入 URL

正确入口：`https://admin.shopify.com/store/{store}/products` → 右上角 **导入**

错误：`/products/import`（404）

## 库存导入

`https://admin.shopify.com/store/{store}/products/inventory?location_id={locationId}`

流程：**导入** → 上传 CSV → **上传文件**（非「上传并预览」）→ **开始导入**（会覆盖库存数量）。

## 分批导入

- 默认每批 **25** 产品；超时 **360s**（产品/库存）
- 进度：`output/shopify/batches/import-log.json`
- 失败：`--from N --to N --force`；库存单独：`--inventory-only`

```powershell
npm run import:batches -- --from 1 --continue-on-error --force
```

## 图片与后处理（推荐路径）

首次 CSV 导入**可以无图**。补图 **不要** CSV 重导：

```powershell
cd D:\dev\独立站上架
node scripts/run-post-import-gql.mjs
```

分步（在 `playwright/` 下）：

```powershell
npm run attach:images        # manifest.imageUrl → productCreateMedia
npm run create:missing       # 漏导产品 → productCreate
npm run assign:collections   # Product Type → collectionAddProducts
```

详见 [shopify-graphql-admin.md](shopify-graphql-admin.md)。

### 为何不用 products-only 重导？

新版 Shopify 预览：**不会覆盖**同名现有产品，且无「覆盖句柄」复选框。

### manifest.imageUrl 来源

1. `patch-shopify-images.mjs`（`files-url-map.json`）
2. 或 Files 上传流程：`6-upload-files` → `7-scrape-files-map` → `normalize-files-map` → patch

有效 CDN：`https://cdn.shopify.com/s/files/1/{shop_id}/files/...`  
无效：`/s/files/applications/`

## Collection

- CSV `Collection` 列 **不会** 把产品加入手动系列
- **推荐**：`npm run assign:collections`（GraphQL `collectionAddProducts`）
- 配置：`config/store.json` → `collections`
- **废弃**：`5-assign-collection.mjs` UI、`run-post-images.mjs` 仅 products-only 重导

## Cloudflare / 登录

真实 Chrome + CDP：`playwright/0-open-chrome.mjs` → `capture` → `shopify-auth.json`

GraphQL 须用 `playwright/lib/shopify-gql.mjs` 在页面上下文调用（见 graphql 文档）。

## PowerShell

监控后台任务时 **勿用 `$pid`**，改用 `$uploadPid` 等。
