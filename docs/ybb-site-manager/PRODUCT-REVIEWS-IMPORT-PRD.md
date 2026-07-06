# 产品评价 Excel 批量导入 — PRD

> **方案代号：** PRI（Product Reviews Import）  
> **版本：** 1.0  
> **站点：** carp-ybb.com  
> **关联插件：** `ybb-product-reviews.php`、`ybb-site-manager`

---

## 1. 背景

- 静态站 PDP 评价来自 WooCommerce `review` 类型评论 + mu-plugin `ybb-product-reviews.php`（REST 列表、晒图 meta）。
- 运营需为新品（如 **TZ-HK-001 三角鲤鱼钩**）批量录入带图好评；竞品调研已产出 Excel（10 条 Amazon 样本）。
- 当前 Woo 后台仅支持**逐条**添加评价，无 Excel/CSV 批量入口；`独立站上架` 管道不包含评价导入。

## 2. 目标

| 目标 | 说明 |
|------|------|
| **G1** | 运营在 WP 后台上传标准 Excel/CSV，预览后一键导入评价 |
| **G2** | 导入后前台评论页与 PDP 徽章**无需 rebuild** 即可展示 |
| **G3** | 支持星级、正文、日期、远程晒图 sideload（最多 3 张/条） |
| **G4** | 可重复执行：已存在评价自动跳过，不产生重复 |

## 3. 用户故事

| 角色 | 故事 | 验收 |
|------|------|------|
| 运营 | 下载官方导入模板，填好 SKU/作者/星级/正文/图片 URL | 模板含说明 sheet + 示例行 |
| 运营 | 在 **YBB 站点管理 → 评价导入** 上传 xlsx，先看预览再确认 | 错误行标红，通过行可导入 |
| 运营 | 导入三角钩 10 条竞品整理后的评价 | REST `review_count`≥10，评论页可见晒图 |
| 开发 | 仅上传 mu-plugin，不改静态 `out/` | 与 AGENTS「评价无需 rebuild」一致 |

## 4. 范围

### 4.1 In Scope（v1.0）

- WP Admin 上传 `.xlsx` / `.csv`（UTF-8 BOM）
- 商品定位：`wc_product_id` **或** `product_sku` **或** `product_handle`（三选一，优先级从左到右）
- 字段：author、email、rating(1–5)、content、date、image_url_1~3、status
- 预览（dry-run）+ 确认导入两步
- 写入 Woo `review` 评论 + `rating` meta + `ybb_review_images`
- 模板下载、导入结果摘要、操作审计（若 audit-log 可用）
- 离线脚本：竞品 Excel → 标准导入表（Python，不入库）

### 4.2 Out of Scope（v1.0）

- 前台用户提交评价流程改造
- 变体级评价（仅父商品 `product_id`）
- 公开 REST 批量写入 API
- 自动翻译 / AI 润色评论正文
- 从 Amazon URL 自动爬取（仅接受 Excel 内已整理字段）
- 静态站 `products.json` 的 `reviewCount` 回写（徽章走 Store API 实时读）

## 5. 非目标与约束

- **不**替代 Woo 单条评价编辑（保留原生 CRUD）
- **不**引入 Composer / PhpSpreadsheet（共享主机友好）
- **不**将竞品原文未润色即上线（运营责任；模板含合规提示）
- 单次导入上限：**200 行** / **5MB** 文件

## 6. 成功指标

| 指标 | 目标 |
|------|------|
| 10 条三角钩评价导入耗时 | ≤5 分钟（含预览） |
| 导入后 REST 可见 | ≤30 秒 |
| 重复导入同文件 | 0 条新增（全部跳过） |
| 部署依赖 | 0 次静态 build |

## 7. 风险登记

| 风险 | 缓解 |
|------|------|
| Amazon 图 URL 服务器下载失败 | 预览标黄；支持仅文字导入；运营可改图 URL 或后补 |
| PHP 执行超时（大批量） | 行数上限 200；`set_time_limit(120)` |
| 竞品评论合规 | PRD + 模板说明；`source_note` 不入库 |
| 跨插件耦合 | Site Manager 仅增加 filter 挂 Tab，核心逻辑在 reviews 插件 |

## 8. 里程碑

| 阶段 | 交付 |
|------|------|
| M0 | PRD + 技术设计 + 实施包（本文档链） |
| M1 | mu-plugin 导入引擎 + Admin UI + 模板 |
| M2 | 生产上传 + TZ-HK-001 导入 10 条验收 |
| M3 | AGENTS / OPS-RUNBOOK 增补 |

## 9. 参考

- 技术设计：`PRODUCT-REVIEWS-IMPORT-DESIGN.md`
- 实施包：`PRODUCT-REVIEWS-IMPORT-IMPLEMENTATION-PACK.md`
- 现有评价：`deploy/wp-content/mu-plugins/ybb-product-reviews.php`
- 前台消费：`lib/woocommerce/product-reviews-api.ts`
