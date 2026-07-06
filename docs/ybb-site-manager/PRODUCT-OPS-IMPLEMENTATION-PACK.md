# 产品运营分层方案 — 实施包

> 配套设计：`PRODUCT-OPS-DESIGN.md`  
> **建议总工期：** 3–4 周（1 人全职），可分 4 个 Sprint 交付。

---

## Sprint 总览

| Sprint | 代号 | 目标 | 可独立上线 |
|--------|------|------|------------|
| S1 | POL-1 | WP 产品 Tab + overrides REST + migrate | 是（仅后台） |
| S2 | POL-2 | PDP live 价/库存/变体 + 加购对齐 | **是（核心价值）** |
| S3 | POL-3 | 列表 live 价 + frontHidden + catalog 管理 API | 是 |
| S4 | POL-4 | Runner 验收 + variation sync 自动化 | 是 |
| S5 | **PCT / POL-5** | PDP Description + Additional info Tab + 后台覆盖 | 是 |

> S5 细则：`PDP-CONTENT-TABS-DESIGN.md`、`PDP-CONTENT-TABS-IMPLEMENTATION-PACK.md`

---

## S1 — POL-1：后台壳 + 覆盖层 REST（mu-plugin 1.3.0）

### S1.1 任务清单

| ID | 任务 | 文件 | 估时 |
|----|------|------|------|
| S1-01 | 新增 `products` 模块骨架 | `includes/modules/products.php` | 4h |
| S1-02 | override 读写 + defaults | `includes/modules/products.php`, `product-overrides-defaults.json` | 4h |
| S1-03 | sanitize + audit 标签 | `class-sanitize.php`, `audit-log.php` | 2h |
| S1-04 | migrate i18n → overrides | `migrate.php` | 3h |
| S1-05 | REST 注册 | `class-rest.php` | 3h |
| S1-06 | Admin Tab 产品（表格+搜索） | `admin/tab-products.php`, `admin/page.php` | 8h |
| S1-07 | 产品索引 transient 缓存 | `includes/modules/product-index.php` | 4h |
| S1-08 | 上传 mu-plugin + 手工验收 | `scripts/upload-ybb-site-manager.py` | 2h |
| S1-09 | 文档 REST 增补 | `REST-SPEC.md` | 1h |

### S1.2 交付物

```
deploy/wp-content/mu-plugins/ybb-site-manager/
├── includes/modules/products.php          # NEW
├── includes/modules/product-index.php     # NEW
├── includes/admin/tab-products.php        # NEW
├── includes/product-overrides-defaults.json # NEW
├── includes/class-rest.php                # EDIT
├── includes/class-sanitize.php            # EDIT
├── includes/migrate.php                     # EDIT
├── includes/admin/page.php                # EDIT (+ tab products)
├── includes/modules/audit-log.php         # EDIT
└── ybb-site-manager.php                   # EDIT version 1.3.0
```

### S1.3 关键实现片段

**`ybb_sm_product_override_get(string $handle): array`**

```php
$all = ybb_sm_get_module('products');
$overrides = $all['overrides'][$handle] ?? [];
return [
    'titleZh' => (string) ($overrides['titleZh'] ?? ''),
    'titleJa' => (string) ($overrides['titleJa'] ?? ''),
    'frontHidden' => !empty($overrides['frontHidden']),
];
```

**Admin 行内 Woo 编辑链接**

```php
$edit = admin_url('post.php?post=' . $wcId . '&action=edit');
```

### S1.4 S1 验收

```powershell
Set-Location "D:\开发\fishAgent\总包\skill\reverse-skill\omc-replica\ybb-site"
py scripts/upload-ybb-site-manager.py
py scripts/blog-rest-acceptance.py   # 回归：博客未破坏
```

- [ ] `GET .../site-manager/product-overrides` 200
- [ ] wp-admin → YBB 站点管理 → **产品** Tab 可搜索 `TZ-XP-038`
- [ ] 保存 `titleZh` 后 REST 立即反映（无需 redeploy）
- [ ] 操作记录有 `products` 模块条目
- [ ] 请求体含 `price` 字段 → 400

---

## S2 — POL-2：PDP Live 合并 + 加购（前端，无需 redeploy 改价）

### S2.1 任务清单

| ID | 任务 | 文件 | 估时 |
|----|------|------|------|
| S2-01 | Store API 单商品 live 拉取 | `lib/woocommerce/product-live-api.ts` | 4h |
| S2-02 | overrides client API | `lib/site-manager/product-overrides-api.ts` | 2h |
| S2-03 | `useProductLive` 合并 hook | `hooks/useProductLive.ts` | 6h |
| S2-04 | ProductDetail 接入 | `components/product/ProductDetail.tsx` | 3h |
| S2-05 | PurchasePanel 用 merged 价/变体 | `ProductPurchasePanel.tsx` | 4h |
| S2-06 | AddToCart 用 live variants | `AddToCartButton.tsx`, `cart-line.ts` | 4h |
| S2-07 | i18n 标题优先 override | `I18nProvider` / `useProductTitle` | 2h |
| S2-08 | 单测 + cart 回归 | `*.test.ts` | 4h |
| S2-09 | build + deploy 静态 JS | `build-static.ps1 -SkipSync` | 2h |

### S2.2 交付物

```
lib/woocommerce/product-live-api.ts       # NEW
lib/site-manager/product-overrides-api.ts # NEW
hooks/useProductLive.ts                   # NEW
components/product/ProductDetail.tsx      # EDIT
components/product/ProductPurchasePanel.tsx # EDIT
components/cart/AddToCartButton.tsx       # EDIT
lib/i18n/I18nProvider.tsx                 # EDIT (optional)
```

### S2.3 `product-live-api.ts` 接口草案

```typescript
export type LiveProductVariant = {
  spec: string;
  sku: string;
  wcId: number;
  price: number;
  compareAtPrice?: number;
  available: boolean;
  wcAttributes?: Array<{ attribute: string; value: string }>;
};

export type LiveProduct = {
  wcId: number;
  name: string;
  price: number;
  compareAtPrice?: number;
  available: boolean;
  variants: LiveProductVariant[];
};

export async function fetchLiveProduct(wcId: number): Promise<LiveProduct | null>;
```

**Store API URL：** 复用 `store-api.ts` 的 `index.php?rest_route=` 模式（避免 Captcha）。

### S2.4 S2 验收

```powershell
npm run build
powershell -File scripts/restart-dev.ps1
py scripts/cart-add-item-acceptance.py
```

- [ ] localhost PDP：Woo 改价后刷新 → 价格更新（**不 rebuild**）
- [ ] `tz-xp-038` 加购 → `add-item` 200（parent + variation）
- [ ] override `titleZh` 保存 → PDP 中文标题更新
- [ ] live 请求失败 → 仍显示静态 fallback，可加购（wcId 一致时）

---

## S3 — POL-3：列表 live 价 + 隐藏 + 管理 API（mu-plugin 1.4.0 + 前端）

### S3.1 任务清单

| ID | 任务 | 文件 | 估时 |
|----|------|------|------|
| S3-01 | `GET product-catalog` 管理员 API | `products.php`, `class-rest.php` | 6h |
| S3-02 | Admin 表格接 catalog API（分页） | `tab-products.php` | 4h |
| S3-03 | `frontHidden` 列表过滤 | `CollectionPageClient.tsx`, `ProductGrid.tsx` | 4h |
| S3-04 | 列表卡片 live 价（批量） | `ProductCard.tsx`, `product-live-api.ts` | 8h |
| S3-05 | Hot Products live 价 | `HotProductsCarousel.tsx` | 3h |
| S3-06 | sessionStorage 60s 缓存 | `product-live-api.ts` | 2h |
| S3-07 | 验收脚本 | `scripts/product-ops-acceptance.py` | 4h |

### S3.2 S3 验收

- [ ] 类目页 24 卡片：Woo 改价后 60s 内更新
- [ ] `frontHidden=true` → 类目/搜索不展示，直链 PDP 显示「不可购」
- [ ] Admin catalog 分页 `search=TZ-XP` 正确
- [ ] `product-ops-acceptance.py` PASS

---

## S4 — POL-4：Runner 自动化 + 漂移验收（runner R3）

### S4.1 任务清单

| ID | 任务 | 文件 | 估时 |
|----|------|------|------|
| S4-01 | runner 集成 variation fix | `ybb-deploy-runner.ps1` | 3h |
| S4-02 | sync Playwright 包装（Captcha） | `scripts/sync-from-wp-playwright.py` | 6h |
| S4-03 | 部署后验收脚本 | `scripts/product-sync-acceptance.py` | 6h |
| S4-04 | runner 回写 productIndex | `deploy-queue.php` + runner PATCH | 2h |
| S4-05 | Admin「待部署」状态（publish 后 static 无 handle） | `tab-products.php` | 4h |
| S4-06 | OPS runbook | `OPS-RUNBOOK-zh.md` | 2h |

### S4.2 Runner 伪代码

```powershell
# ybb-deploy-runner.ps1 (excerpt)
py scripts/sync-from-wp-playwright.py --fetch-variations
py scripts/fix-variation-ids-playwright.py
powershell -File scripts/build-static.ps1 -SkipSync -SkipDeploy
py scripts/audit-deploy-package.py
if ($LASTEXITCODE -ne 0) { exit 1 }
powershell -File scripts/deploy-siteground-browser.ps1 -SkipBuild
py scripts/product-sync-acceptance.py
py scripts/verify-remote-deploy.py
```

### S4.3 S4 验收

- [ ] Woo 发布测试 SKU → 60min 内 PDP 200
- [ ] `product-sync-acceptance.py`：10 SKU wcId 对齐 + 3 SKU add-item 200
- [ ] 产品 Tab 显示 `lastBuildId` 与 deploy 状态一致

---

## 一键命令速查（实施人员）

### 开发环境

```powershell
Set-Location "D:\开发\fishAgent\总包\skill\reverse-skill\omc-replica\ybb-site"

# mu-plugin 上传
py scripts/upload-ybb-site-manager.py

# 手动触发全量产品同步部署
# wp-admin → YBB 站点管理 → 部署状态 → 立即同步
# 或 REST（需 deploy secret）

# 仅修 variation id 漂移
py scripts/fix-variation-ids-playwright.py
py scripts/fix-variation-ids-playwright.py --handle tz-xp-038

# 静态前端（跳过 sync，避免 Captcha）
powershell -ExecutionPolicy Bypass -File scripts/build-static.ps1 -SkipSync -SkipDeploy
powershell -ExecutionPolicy Bypass -File scripts/deploy-siteground-browser.ps1 -SkipBuild
py scripts/verify-remote-deploy.py
```

### 运营日常（目标态）

| 操作 | 入口 | 生效时间 |
|------|------|----------|
| 改价格 / 库存 | Woo 产品编辑 | PDP **即时**（S2 后） |
| 改中文/日文标题 | YBB 站点管理 → 产品 → 覆盖 | **即时** |
| 前台暂时隐藏 | 覆盖层 `frontHidden` | **即时** |
| 上新 / 改变体 / 改 SKU | Woo 发布 | deploy 后 **≤60min** |
| 手动全量同步 | 部署状态 Tab | debounce 5min |

---

## 测试矩阵

| 场景 | 期望 | Sprint |
|------|------|--------|
| Woo 涨价 1.99→2.49 | PDP 显示 2.49，加购按 2.49 | S2 |
| Woo 下架 | PDP 不可购，checkout 拦截 | S2 |
| override titleZh | 中文标题变，英文仍 Woo | S1+S2 |
| frontHidden | 列表无，PDP 提示 | S3 |
| 新品 publish | 新 handle.html 200 | S4 |
| variation 漂移 | acceptance 失败 → 不 deploy | S4 |
| 旧购物车 localStorage | checkout retry 或提示重加 | 已有 |

---

## 新增验收脚本（S3/S4 交付）

**`scripts/product-ops-acceptance.py`** — 读路径：

1. `GET /ybb/v1/site-manager/product-overrides`
2. `GET /ybb/v1/site-manager/product-overrides/tz-xp-038`
3. 浏览器打开 PDP，断言 live 价 DOM
4. `add-item` 200

**`scripts/product-sync-acceptance.py`** — 部署后：

1. 对比静态 HTML 内嵌 wcId vs Store API
2. 抽样 add-item
3. 输出 `reports/product-sync-acceptance.json`

---

## 依赖与前置

| 项 | 状态 |
|----|------|
| ybb-site-manager ≥ 1.2.0（博客） | 已有 |
| deploy-queue + runner | 已有，需 S4 补强 |
| store-api invalid_product retry | 已落地 |
| fix-variation-ids-playwright.py | 已落地 |
| Woo Playwright 上架管道 | `D:\dev\独立站上架\` |

---

## 回滚策略

| 层级 | 回滚 |
|------|------|
| mu-plugin 1.3.x | 浏览器上传上一版 `ybb-site-manager/` |
| 前端 live fetch | 特性开关 `NEXT_PUBLIC_PRODUCT_LIVE=0`（env，默认开） |
| overrides 数据 | Admin 恢复默认 / 删 `products.overrides` 键 |
| 错误 deploy | `upload-manifest.json` 上一 buildId 增量（紧急） |

---

## 下一步（请你拍板）

1. **先做 S1+S2**（2 周）：后台产品 Tab + PDP 改价即时生效 — 性价比最高  
2. **S4 与 S2 并行**：runner 验收避免再次 checkout 400  
3. **暂缓 S3 列表 live 价**：若首屏性能敏感，可放到 S3

确认后可从 **S1-01** 开始拆 PR / 直接开发。
