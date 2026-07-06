# 产品评价 Excel 批量导入 — 实施包

> 配套文档：`PRODUCT-REVIEWS-IMPORT-PRD.md`、`PRODUCT-REVIEWS-IMPORT-DESIGN.md`  
> **建议工期：** 2–3 天（1 人），可分 2 个 Sprint。

---

## Sprint 总览

| Sprint | 代号 | 目标 | 可独立上线 |
|--------|------|------|------------|
| S1 | PRI-1 | 导入引擎 + 解析 + 单元手测 | 否（无 UI） |
| S2 | PRI-2 | Admin UI + SM Tab + 模板 + 部署 + 三角钩验收 | **是** |

---

## S1 — PRI-1：导入引擎（mu-plugin 1.2.0 基础）

### S1.1 任务清单

| ID | 任务 | 文件 | 估时 |
|----|------|------|------|
| S1-01 | 重构 loader：主文件 require 子模块 | `ybb-product-reviews.php` | 1h |
| S1-02 | 嵌入 SimpleXLSX | `includes/lib/SimpleXLSX.php` | 0.5h |
| S1-03 | CSV + XLSX 解析 → 行数组 | `review-import-engine.php` | 3h |
| S1-04 | 商品解析（id/sku/handle + parent 提升） | `review-import-engine.php` | 2h |
| S1-05 | `wp_insert_comment` + rating meta | `review-import-engine.php` | 2h |
| S1-06 | 晒图 sideload（抽取现有 upload 函数） | `ybb-product-reviews.php`, `review-import-engine.php` | 3h |
| S1-07 | 去重 + batch + dry_run | `review-import-engine.php` | 2h |
| S1-08 | 抽取 `ybb_pr_sideload_review_image()` 供表单/导入共用 | `ybb-product-reviews.php` | 1h |

### S1.2 交付物

```
deploy/wp-content/mu-plugins/
├── ybb-product-reviews.php
└── ybb-product-reviews/
    └── includes/
        ├── review-import-engine.php
        └── lib/SimpleXLSX.php
```

### S1.3 手测脚本（wp-cli 或临时 admin-ajax）

在 staging / 本地 WP 执行单行导入（dry_run=false）：

```php
$row = [
    'wc_product_id' => 50689,
    'author' => 'Test Import',
    'email' => 'test@import.local',
    'rating' => 5,
    'content' => 'PRI smoke test ' . time(),
    'status' => 'approved',
];
$result = ybb_pr_import_insert_row($row, 50689, false);
```

### S1.4 S1 验收

- [ ] `wp_insert_comment` 成功，`comment_type=review`
- [ ] `get_comment_meta(..., 'rating')` = 5
- [ ] 远程 jpg URL sideload 后 `ybb_review_images` 有 attachment id
- [ ] `GET /ybb/v1/product-reviews/50689` 含新评论
- [ ] 同 content 再导入 → `skip`

---

## S2 — PRI-2：Admin UI + 集成 + 首单数据

### S2.1 任务清单

| ID | 任务 | 文件 | 估时 |
|----|------|------|------|
| S2-01 | Admin 页面：上传 / 预览 / 确认 | `review-import-admin.php` | 4h |
| S2-02 | Site Manager filter 挂 Tab | `ybb-site-manager/.../page.php` | 1h |
| S2-03 | Woo fallback 子菜单（SM 未启用时） | `review-import-admin.php` | 0.5h |
| S2-04 | 模板 xlsx + 下载路由 | `assets/product-reviews-import-template.xlsx` | 1h |
| S2-05 | audit-log module `reviews_import` | `audit-log.php` | 0.5h |
| S2-06 | 离线转换脚本 + 三角钩 xlsx | `convert_competitor_reviews_to_import.py` | 2h |
| S2-07 | 更新 `upload-mu-plugins.py` 支持目录上传 | `scripts/upload-mu-plugins.py` | 1h |
| S2-08 | 生产部署 + 导入 10 条 + 验收 | 运维 | 1h |
| S2-09 | 更新 AGENTS 商品评价节 | `AGENTS.md` | 0.5h |

### S2.2 Admin 表单要点

```php
// review-import-admin.php
function ybb_pr_render_import_admin_page(): void {
    // 1. 模板下载 link: admin.php?page=ybb-site-manager&tab=reviews-import&download=template
    // 2. enctype multipart/form-data
    // 3. hidden step: preview | import
    // 4. transient 存预览结果 key: ybb_pr_import_preview_{user_id}，import 时复用，防篡改
}
```

**防篡改：** 确认导入时不重新解析上传文件，而是读取 preview transient（含文件 hash + 解析行），避免 POST 篡改 sku。

### S2.3 Site Manager 改动（最小）

[`page.php`](../../deploy/wp-content/mu-plugins/ybb-site-manager/includes/admin/page.php)：

```php
// L25 附近
$allowed = apply_filters('ybb_sm_admin_allowed_tabs', [
    'navigation', 'announcements', 'hero', 'home', 'blog', 'products',
    'video', 'featured', 'brand', 'contact', 'deploy', 'audit',
]);

// L47 labels 之后
$labels = apply_filters('ybb_sm_admin_tab_labels', $labels);

// switch 后、form 结束前（deploy/audit 之外）
if ($tab === 'deploy' || $tab === 'audit') { /* existing */ }
elseif (has_action('ybb_sm_admin_render_tab_' . $tab)) {
    do_action('ybb_sm_admin_render_tab_' . $tab);
} elseif (/* existing modules */) { ... }
```

`ybb-product-reviews.php`：

```php
add_action('ybb_sm_admin_render_tab_reviews-import', 'ybb_pr_render_import_admin_page');
```

### S2.4 部署命令

```powershell
Set-Location "D:\开发\fishAgent\总包\skill\reverse-skill\omc-replica\ybb-site"

# 1. Site Manager filter（若改 page.php）
py scripts/upload-ybb-site-manager.py

# 2. Reviews 插件目录（更新后的 upload 脚本）
py scripts/upload-mu-plugins.py

# 3. 验收
curl "https://carp-ybb.com/index.php?rest_route=/ybb/v1/product-reviews/50689"
```

浏览器备选：SiteGround File Manager 上传整个 `ybb-product-reviews/` 文件夹。

### S2.5 三角钩首单流程

```powershell
# 生成导入表
Set-Location "D:\开发\fishAgent\总包\skill\reverse-skill"
python scripts/cross-border-ecom/convert_competitor_reviews_to_import.py
```

运营：

1. WP → **YBB 站点管理 → 评价导入**
2. 下载模板（核对列）
3. 上传 `tz-hk-001-reviews-import-*.xlsx`
4. 预览：10 行 ok，product_id=50689
5. 确认导入
6. 打开 `https://carp-ybb.com/products/tz-hk-001/reviews`

### S2.6 S2 验收清单

- [ ] Tab「评价导入」可见（`manage_options` 用户）
- [ ] 模板下载 200，列与 DESIGN 一致
- [ ] 预览：缺 `rating` 行标 error；不存在 SKU 标 error
- [ ] 导入 10 条：ok=10
- [ ] REST `review_count` ≥ 10，`reviews[].images` 非空（图成功时）
- [ ] 再次导入：skip=10
- [ ] 操作记录有「评价导入」条目
- [ ] **未**执行 `build-static.ps1`

---

## 回滚

| 场景 | 操作 |
|------|------|
| 误导入 | WP → 评论 → 筛选产品 → 批量删除；或 Woo → 评价 |
| 插件故障 | 删除 `ybb-product-reviews/` 目录，保留旧版单文件 backup |
| 部分晒图失败 | 评论保留；Woo 媒体库手动补图或重跑仅图列 |

---

## 不在本包内（明确排除）

- 前台 `ProductReviewCard` 改动
- `sync-from-wp.mjs` 写 `reviewCount`
- 竞品自动爬取
- 多语言评价正文

---

## 估时合计

| Sprint | 估时 |
|--------|------|
| S1 | ~14.5h |
| S2 | ~11.5h |
| **合计** | **~26h（约 3 工作日）** |
