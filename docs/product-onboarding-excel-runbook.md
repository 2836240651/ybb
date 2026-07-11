# carp-ybb.com 产品上架 Excel 固化 Runbook

目标：运营只交付一份固定 Excel，一个工作表横向填写。开发/自动化按同一口径导入 Woo、写入 YBB Site Manager 覆盖层、触发部署机 Sync，避免每次上架反复补字段。

固定模板：`deploy/product-import/templates/carp-ybb_product-listing-template-single-sheet.xlsx`  
唯一工作表：`产品上架`

表头要求：中文展示，括号保留稳定字段 key，例如 `父SKU (parent_sku)`。运营只看中文填表；自动化按括号内 key 对齐字段。

生成命令：

```powershell
Set-Location "D:\开发\fishAgent\总包\skill\reverse-skill\omc-replica\ybb-site"
py scripts\generate-product-listing-template.py
```

## 1. 全链路分层

| 阶段 | 输入 | 写入系统 | 输出 / 验收 |
|------|------|----------|-------------|
| 运营填表 | `产品上架` 单表 + 图片 | 不直接写站点 | 字段完整、SKU 唯一、图片可访问 |
| Woo 上架 | Woo 基础字段 + 变体字段 | WooCommerce | 父商品/变体、价格、库存、英文 Description、类目、图片 |
| YBB 覆盖 | YBB 覆盖字段 | YBB 站点管理 | 中文/日文标题、中文/日文 Description、图库顺序、隐藏状态 |
| 静态同步 | Woo/WP 线上数据 | Ubuntu 部署机 `/opt/ybb-site` | `products/{handle}.html`、`products.json`、wcId/variationId 对齐 |
| 生产验收 | 前台 + REST | SiteGround | PDP 200、三语切换、Additional Info、加购、checkout |

## 2. 单表横向字段分组

`产品上架` 从左到右分 5 段，不再拆多个工作区：

| 分组 | 字段范围 | 谁负责 | 作用 |
|------|----------|--------|------|
| Woo 基础 + 三语描述 | `parent_sku` 到 `attribute_name` | 运营 | 父 SKU、handle、三语标题/描述、类目、状态、属性名 |
| 变体 1-6 | `variant1_*` 到 `variant6_*` | 运营 | 每个可售规格的 SKU、规格值、价格、库存、可选图片 |
| 图片资产 | `main_image_url` 到 `image_ready_0_1` | 运营 | 主图、图库、本地图片路径、图片 alt、图片是否齐备 |
| YBB 站点管理覆盖 | `hide_description_0_1` 到 `hide_slogan_0_1` | 运营/开发 | PDP Tab、前台隐藏、图库覆盖、购买区 slogan |
| 评价可选 + 备注 | `review_author` 到 `ops_note` | 运营 | 可选评价导入和交付备注 |

## 3. 必填字段

| 字段 | 必填 | 说明 |
|------|------|------|
| `parent_sku` | 是 | 父 SKU，稳定不改；如 `TZ-QZ-002` |
| `handle` | 是 | 前台路由 slug，如 `tz-qz-002` |
| `title_en` | 是 | Woo 英文商品名 |
| `title_zh` / `title_ja` | 建议 | 用于前台语言切换；不填会回退英文或旧覆盖 |
| `description_en_html` | 是 | Woo 英文长描述，支持 HTML |
| `description_zh_html` / `description_ja_html` | 建议 | 中文/日文描述不会自动跟随 Woo 英文翻译 |
| `category` | 是 | 从下拉选项选择 |
| `status` | 是 | 未验收填 `draft`，最终上架填 `publish` |
| `attribute_name` | 建议 | 如 `Weight` / `Specification` / `Hook Size` / `Color` / `Size` |
| `variantN_sku` | 是 | 每个可售规格一条 SKU |
| `variantN_parent_sku` | 是 | 必须等于 `parent_sku` |
| `variantN_spec_value` | 是 | 前台规格和 Additional Info 的来源，如 `56g` |
| `variantN_price_usd` | 是 | 数字，不带 `$` |
| `variantN_in_stock_0_1` | 是 | `1` 有货，`0` 缺货 |
| `main_image_url` 或 `local_image_path` | 是 | 二选一；HTTPS URL 优先 |
| `image_ready_0_1` | 是 | 图片确认齐备填 `1` |

规则：一个父 SKU 最多 6 个变体。超过 6 个时不得临时加列，先更新模板生成器、导入器和本文档。

## 4. 自动化应该做什么

1. 校验 Excel：必填字段、SKU 唯一、父子 SKU 一致、状态枚举、价格数字、图片 `image_ready_0_1=1`。
2. Woo 导入：创建/更新父商品、变体、价格、库存、类目、英文 Description、主图/图库。
3. YBB 覆盖：按 handle 写入 `title_zh/title_ja/description_zh_html/description_ja_html/gallery/slogan/front_hidden`。
4. 触发 Sync：Woo 发布或新增变体后，使用 YBB 站点管理的部署状态 Sync，由 Ubuntu 部署机拉 Woo/WP 数据、构建、部署。
5. 部署验收：`verify-remote-deploy.py` + `product-sync-acceptance.py --post-deploy`。

本地前端代码、样式、构建逻辑变更不属于产品 Excel 上架：必须先完整源码同步到 Ubuntu 部署机，再由部署机构建部署。

## 5. 必过验收

| 检查 | 通过标准 |
|------|----------|
| Woo 后台 | 商品 publish，父 SKU、变体 SKU、价格、类目、图片正确 |
| Store API | `wcId` / `variationId` 可被前台加购使用 |
| PDP | `/products/{handle}` HTTP 200 |
| 三语标题 | EN/ZH/JA 切换后标题正确 |
| Description | EN 读 Woo；ZH/JA 读 Site Manager 覆盖或明确回退 |
| Additional Info | 规格值跟随语言标签显示，不丢失重量/尺寸等值 |
| 图片 | 主图和图库无缺图；图片缺口可解释 |
| 加购 | 选中每类关键变体后 add-item 成功，checkout 可进入 |
| 部署状态 | `pending=false`，`lastBuildId` 等于线上 buildId |

## 6. 固定结论

- 新上架以 `carp-ybb_product-listing-template-single-sheet.xlsx` 的 `产品上架` 单表为唯一运营模板。
- 不允许运营临时新增 Excel 列或改字段名。
- 需要新字段时，先更新模板生成器、导入/校验脚本、runbook，再收运营表。
- 不允许“只上 Woo 结构，后补三语/图片”；三语和图片缺口必须在导入前形成告警清单。
