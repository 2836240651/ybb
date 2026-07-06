# 产品运营分层方案 — 技术设计清单

> **方案代号：** Product Ops Layer（POL）  
> **版本：** 1.0  
> **原则：** Woo 为唯一真源；Site Manager 为运营壳 + 展示覆盖；静态站负责路由壳与 SEO 骨架。

---

## 1. 目标与边界

### 1.1 目标

| 用户故事 | 技术手段 |
|----------|----------|
| 运营改价格 / 库存后前台尽快一致 | PDP / 列表 client fetch Woo Store API |
| 运营改三语标题而不 rebuild | Site Manager `product-overrides` REST overlay |
| 运营上架新品后 PDP 可访问 | Phase 3 deploy-queue（已有 hook，补齐 runner + 验收） |
| 运营在统一后台查 SKU / wcId / 同步状态 | Site Manager「产品」Tab（只读索引 + 快捷入口） |
| 避免 checkout 400（wcId 漂移） | 结构化字段分层 + deploy 后校验 + cart retry（已部分落地） |

### 1.2 非目标

- 不在 `wp_options` 存 489×变体完整商品库替代 Woo
- 不在 Site Manager 单独改 SKU / wcId 而不写回 Woo
- Phase 2.5 不做全站 runtime PDP（不废弃静态 `products/{handle}.html`）
- 不合并 Quorlyx / Checkout / My Account

---

## 2. 架构：三层数据模型

```
┌─────────────────────────────────────────────────────────────┐
│ Layer A — 静态壳（build 时 bake，变更需 deploy）              │
│ handle, collection, images[], layout, SEO 骨架, wcId 快照   │
│ 源：sync-from-wp.mjs → products.json → generateStaticParams   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ Layer B — Woo 真源（结账 / 库存 / SKU / 变体结构）             │
│ WC_Product + Store API /wc/store/v1/products/{id}          │
│ 源：Woo 后台 / Playwright 上架管道                            │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ Layer C — 运营覆盖（可选，REST，保存即生效）                   │
│ titleZh/titleJa, frontHidden, merchandisingNote             │
│ 源：ybb_site_manager_settings.products.overrides[handle]     │
└─────────────────────────────────────────────────────────────┘
```

### 2.1 字段归属矩阵（硬性）

| 字段 | Layer | 写入入口 | 前台读取 | 需 deploy |
|------|-------|----------|----------|-----------|
| `handle` | A | sync（来自 parent SKU slug） | 静态路由 | 是 |
| `collection` | A | sync / catalog | 静态 + 列表 | 是 |
| `images[]` | A | sync + 媒体管道 | 静态（可 Phase 4 拉 Woo 图） | 是 |
| `wcId` / `wcVariationId` | A+B | sync-from-wp | 加购 / checkout | 结构变更需 deploy |
| `sku` / 变体 spec | B | Woo | Store API + 静态 fallback | 结构变更需 deploy |
| `price` / `compareAtPrice` | B | Woo | **client Store API** | 否 |
| `available` / stock | B | Woo | **client Store API** | 否 |
| `title` (EN) | B | Woo name | overlay 可覆盖 | 否（若仅 REST） |
| `titleZh` / `titleJa` | C | Site Manager | REST overlay | 否 |
| `frontHidden` | C | Site Manager | REST + 列表过滤 | 否 |
| `reviewCount` | B | Woo | client（已有） | 否 |

---

## 3. REST 契约（新增）

Base URL（与现有一致）：

```
/index.php?rest_route=/ybb/v1/site-manager/{endpoint}&_={timestamp}
```

### 3.1 GET `/ybb/v1/site-manager/product-catalog`

**用途：** 运营后台产品索引（分页）；前台可选批量拉取 overrides（非全量商品体）。

**Query：** `page`, `per_page`（max 50）, `search`（sku/handle/title）

**Response：**

```json
{
  "page": 1,
  "perPage": 20,
  "total": 489,
  "items": [
    {
      "handle": "tz-xp-038",
      "parentSku": "TZ-XP-038",
      "wcId": 50886,
      "wooStatus": "publish",
      "wooName": "Carp New - Small Blowback Line",
      "price": 1.99,
      "inStock": true,
      "variantCount": 4,
      "collection": "2026-new-products",
      "staticSyncedAt": "2026-06-29T01:00:00Z",
      "hasOverride": true,
      "frontHidden": false,
      "editUrl": "https://carp-ybb.com/wp-admin/post.php?post=50886&action=edit",
      "pdpUrl": "https://carp-ybb.com/products/tz-xp-038"
    }
  ],
  "syncedAt": "2026-06-29T12:00:00Z"
}
```

**实现要点：**

- 索引数据来自 Woo `WC_Product_Query`（publish 优先），handle 用现有 `ybb_home_wc_find_product_by_handle` 或 SKU→slug 映射
- `staticSyncedAt` 读 WP option `ybb_sm_product_index_meta.lastBuiltAt`（runner 回写）
- **Permission：** GET 公开仅返回 `overrides` 子集；完整 catalog 需 `manage_options` 或 `X-YBB-Deploy-Key`

### 3.2 GET `/ybb/v1/site-manager/product-overrides`

**用途：** 前台 client overlay（体量可控，只存有覆盖的 handle）。

```json
{
  "enabled": true,
  "overrides": {
    "tz-xp-038": {
      "titleZh": "红虫小偏转件反吹编织线",
      "titleJa": "カープ新製品 - Small Blowback Line",
      "frontHidden": false
    }
  },
  "syncedAt": "..."
}
```

### 3.3 GET `/ybb/v1/site-manager/product-overrides/{handle}`

单商品覆盖 + 合并 Woo _live_ 字段（供 PDP 一次请求）：

```json
{
  "handle": "tz-xp-038",
  "wcId": 50886,
  "titles": {
    "en": "Carp New - Small Blowback Line",
    "zh": "红虫小偏转件反吹编织线",
    "ja": "カープ新製品 - Small Blowback Line"
  },
  "price": 1.99,
  "compareAtPrice": null,
  "available": true,
  "variants": [
    {
      "spec": "2#",
      "sku": "TZ-XP-038-2#",
      "wcId": 50898,
      "price": 1.99,
      "available": true,
      "wcAttributes": [{ "attribute": "Specification", "value": "2#" }]
    }
  ],
  "frontHidden": false,
  "syncedAt": "..."
}
```

**合并规则：**

1. `titles.en` ← Woo `get_name()`  
2. `titles.zh/ja` ← override 非空则用 override，否则 fallback 静态 JSON（migrate 时从 `product-i18n-by-sku.json` 灌入）  
3. `price/variants` ← Woo Store API 或 `WC_Product` 变体（**禁止**用 override 写价）  
4. `frontHidden` ← override only

### 3.4 POST `/ybb/v1/site-manager/product-overrides/{handle}`

**Permission：** `manage_options`（admin）或未来 Application Password

**Body：**

```json
{
  "titleZh": "…",
  "titleJa": "…",
  "frontHidden": false
}
```

**禁止字段：** `sku`, `wcId`, `price`, `variants`（请求含这些字段 → 400）

### 3.5 POST `/ybb/v1/deploy/trigger`（已有，扩展 reason）

```json
{ "reason": "product_sync_manual", "handles": ["tz-xp-038"] }
```

`handles` 可选；runner 仍全量 sync（首版），日志记录触发原因。

---

## 4. WordPress / mu-plugin 设计

### 4.1 新模块文件

| 文件 | 职责 |
|------|------|
| `includes/modules/products.php` | 索引查询、override 读写、Woo 合并 |
| `includes/modules/product-index.php` | 构建轻量索引缓存（transient，15min TTL） |
| `includes/admin/tab-products.php` | 产品 Tab UI |
| `includes/product-overrides-defaults.json` | migrate 种子（从 i18n JSON） |

### 4.2 Settings 结构（`ybb_site_manager_settings`）

```json
{
  "products": {
    "enabled": true,
    "overrides": {
      "tz-xp-038": {
        "titleZh": "…",
        "titleJa": "…",
        "frontHidden": false,
        "updatedAt": "2026-06-29T12:00:00Z"
      }
    }
  },
  "productIndex": {
    "lastBuiltAt": "2026-06-29T01:00:00Z",
    "lastBuildId": "EWSzaTc6IToV9p5xOfWX_",
    "productCount": 489
  }
}
```

**体积控制：** overrides 只存有改动的 handle（预计 <100 条）；禁止存全量 variants。

### 4.3 Admin Tab「产品」

| 区块 | 内容 |
|------|------|
| 搜索栏 | SKU / handle / 标题 |
| 表格列 | SKU、handle、Woo 状态、价、库存、wcId、静态 sync 时间、覆盖标记 |
| 行操作 | 「Woo 编辑」链接、「编辑覆盖」折叠表单、「触发同步部署」 |
| 顶部 | 上次 deploy buildId、「立即同步全部产品」按钮（调 deploy-queue） |

### 4.4 Sanitize / Audit

- `ybb_sm_sanitize_products()` — 仅 `titleZh/titleJa/frontHidden`，strip tags
- `ybb_sm_audit_log` — 增删改 override、手动 deploy 触发

### 4.5 Migrate

`ybb_sm_maybe_migrate_products()`：

1. 从 `product-i18n-by-sku.json` 导入 `titleZh/titleJa` 到 overrides（一次性）
2. 写 `productIndex.lastBuiltAt` 若空

---

## 5. 前端设计

### 5.1 新文件

| 路径 | 职责 |
|------|------|
| `lib/site-manager/product-overrides-api.ts` | `fetchProductOverrides`, `fetchProductLive` |
| `lib/woocommerce/product-live-api.ts` | Store API 拉价/库存/变体（PDP 专用） |
| `hooks/useProductLive.ts` | 合并 static Product + live + overrides |
| `lib/store/cart-line.ts` | 加购前用 live variants 校验 wcId（与 store-api retry 配合） |

### 5.2 数据合并（`useProductLive`）

```typescript
// 优先级
title[locale]  = override[locale] ?? static[locale] ?? woo.en
price          = live.price ?? static.price
available      = live.available && !override.frontHidden
variants       = live.variants?.length ? live.variants : static.variants
wcId           = live.wcId ?? static.wcId  // live 优先，防漂移
```

### 5.3 组件改动

| 组件 | 改动 |
|------|------|
| `ProductDetail.tsx` | 包一层 `useProductLive(product)` |
| `ProductPurchasePanel.tsx` | 用 merged product 显示价/库存/变体 |
| `ProductCard.tsx` / `ProductGrid` | 列表价 client fetch（批量 by wcId，见 5.4） |
| `AddToCartButton` | `buildCartLine` 用 merged variants |
| `CollectionPageClient` | `frontHidden` 过滤（overrides 批量 GET） |

### 5.4 列表页批量 live 价（性能）

- 每页最多 24 张卡片 → `GET /wc/store/v1/products?include=id1,id2,...`（若 API 支持）或并行 6 路 fetch
- fallback：显示静态价，live 回来后更新 DOM（避免布局跳动：预留宽度）

### 5.5 静态壳约定（延续 Phase 1 规则）

- `products.json` 在 build 时仍写入，作 **offline fallback**
- **禁止** `useState(staticCatalog)` 预填真实价而不拉 live
- PDP metadata（`generateMetadata`）仍用静态 title；可选 Phase 4 用 client `document.title` 覆盖

---

## 6. 部署与同步流水线（Phase 3 补齐）

### 6.1 触发器（已有 + 补强）

| 事件 | Hook | 动作 |
|------|------|------|
| 产品首次 publish | `transition_post_status` | `deploy_queue(product_publish)` |
| 已发布产品 save | `save_post_product` | `deploy_queue(product_update)` |
| 运营手动 | Admin / REST | `deploy_queue(manual)` |

### 6.2 Runner 步骤（`ybb-deploy-runner.ps1`）

1. `node scripts/sync-from-wp.mjs --fetch-variations`（Playwright 包装若 Captcha）
2. `node scripts/fix-variation-ids-playwright.py`（可选，Captcha 环境）
3. `npm run build` + `build-static.ps1 -SkipSync -SkipDeploy`
4. `audit-deploy-package.py` — BLOCKED 则失败
5. FTPS 4 files + Playwright unzip
6. `PATCH deploy/status` + 回写 `productIndex.lastBuildId`

### 6.3 部署后校验（新增）

`scripts/product-sync-acceptance.py`：

- 抽样 10 SKU：静态 HTML wcId == Store API parent id
- 抽样 3 SKU：`add-item` 200
- 写 report → `reports/product-sync-acceptance.json`

---

## 7. 安全与权限

| 端点 | 读 | 写 |
|------|----|----|
| `product-overrides`（全量） | 公开 | — |
| `product-overrides/{handle}` | 公开 | `manage_options` |
| `product-catalog` | 管理员 | — |
| Woo 写回（Phase 4 可选） | — | Application Password + audit |

---

## 8. 风险与缓解

| 风险 | 缓解 |
|------|------|
| 双真源再次漂移 | 价/库存只信 Woo；wcId 以 live 为准；deploy 后 acceptance |
| SG Captcha 阻断 sync | Playwright 包装 `sync-from-wp`；runner 失败写 `lastError` |
| 列表页 N+1 fetch | 批量 include + 缓存 60s sessionStorage |
| overrides 与 Woo 标题不一致 | Admin 显示「Woo 原名」对照 |
| 新品无静态页 | deploy-queue 必跑；Admin 显示「待部署」状态 |

---

## 9. 版本规划

| 版本 | 代号 | 交付 |
|------|------|------|
| mu-plugin **1.3.0** | POL-1 | overrides REST + Admin 产品 Tab（只读索引） |
| mu-plugin **1.4.0** | POL-2 | PDP `useProductLive` + 加购 live variants |
| mu-plugin **1.5.0** | POL-3 | 列表 live 价 + `frontHidden` |
| runner **R3** | POL-4 | 全量验收脚本 + variation sync 纳入 runner |
| mu-plugin **1.6.0** | **PCT / POL-5** | PDP Description + Additional info Tab；详见 `PDP-CONTENT-TABS-DESIGN.md` |
| **2.0**（可选） | POL-6 | Admin 改价写回 Woo REST（仍不写第二套库） |

---

## 10. 技术设计清单（勾选式）

### 架构

- [ ] 字段归属矩阵评审通过（产品 / 运营 / 开发）
- [ ] 明确禁止 Site Manager 存 SKU/wcId/价格
- [ ] 与现有博客 REST 模式对齐（静态壳 + client overlay）

### 后端

- [ ] `products.php` + `product-index.php` 模块
- [ ] REST 4 端点注册 + `REST-SPEC.md` 更新
- [ ] `ybb_sm_sanitize_products` + audit 标签
- [ ] migrate：i18n → overrides
- [ ] Admin Tab「产品」+ 分页搜索
- [ ] `product-catalog` 管理员权限门禁

### 前端

- [ ] `product-overrides-api.ts` + `product-live-api.ts`
- [ ] `useProductLive` hook
- [ ] `ProductDetail` / `ProductPurchasePanel` 接入
- [ ] `AddToCartButton` / `buildCartLine` live 校验
- [ ] Collection `frontHidden` 过滤
- [ ] 列表 live 价（POL-3）

### 部署

- [ ] runner 回写 `productIndex`
- [ ] `product-sync-acceptance.py`
- [ ] `fix-variation-ids-playwright.py` 纳入文档/runner
- [ ] deploy 失败 admin notice（已有）

### 文档

- [ ] `PRODUCT-OPS-IMPLEMENTATION-PACK.md` 任务包
- [ ] `OPS-RUNBOOK-zh.md` 增补「产品运营」章节
- [ ] `ACCEPTANCE-CHECKLIST.md` POL 验收节

---

## 参考

- 现有 PRD：`PRD.md`
- REST：`REST-SPEC.md`
- 部署：`PHASE3-DEPLOY-PIPELINE.md`
- 插件：`deploy/wp-content/mu-plugins/ybb-site-manager/`
- 购物车加固：`lib/woocommerce/store-api.ts`（invalid_product retry）
