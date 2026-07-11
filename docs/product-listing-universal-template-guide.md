# carp-ybb 产品上架通用 Excel 模板填写说明

模板路径：`deploy/product-import/templates/carp-ybb_product-listing-template-universal.xlsx`

## 总规则

- 只用一个工作表：`产品上架`。
- 第 1 行是总说明，第 2 行是分组，第 3 行是字段表头。
- 从第 4 行开始填写产品数据，一行一个父产品。
- 表头中文可以看，括号里的英文 key 给自动化读取，禁止删除或改名。
- 正式上架前，必填字段必须完整；自动化回填区运营不用填。
- 产品已经通过 CSV 建过基础结构时，本表用于定位现有父 SKU 并更新详情、变体、图片、三语、YBB 展示覆盖。

## Woo 基础 + 三语描述

| 字段 | 必填 | 怎么填 | 示例 | 注意 |
|---|---:|---|---|---|
| 父SKU (`parent_sku`) | 是 | 填 Woo 里已有的父产品 SKU | `TZ-EL-074` | 不要填变体 SKU。 |
| 前台路径slug (`handle`) | 是 | 填产品 URL 最后一段，小写字母/数字/中横线 | `tz-el-074` | 一般等于父 SKU 小写。 |
| 英文标题 (`title_en`) | 是 | 英文前台标题 | `Pang San Xian Bait Cage` | 不要堆规格。 |
| 中文标题 (`title_zh`) | 是 | 中文前台标题 | `胖三弦` | 语言切换后显示。 |
| 日文标题 (`title_ja`) | 是 | 日文前台标题 | `Pang San Xian ベイトケージ` | 没有可靠日文时先给英文名 + 品类日文。 |
| 英文描述HTML (`description_en_html`) | 是 | 写 `<p>...</p>` 段落 | `<p>Designed for carp rigs...</p>` | 只写卖点、使用场景、结构特点；不要写重量、价格、规格表。 |
| 中文描述HTML (`description_zh_html`) | 是 | 中文 `<p>...</p>` 段落 | `<p>适用于欧鲤钓组...</p>` | 不要把附加信息区内容搬进描述区。 |
| 日文描述HTML (`description_ja_html`) | 是 | 日文 `<p>...</p>` 段落 | `<p>カープリグ向け...</p>` | 必须随语言切换显示。 |
| 类目 (`category`) | 是 | 用下拉选项 | `饵笼 (Bait Cages)` | 括号里的英文 key 禁止删除。 |
| 子类目 (`subcategory`) | 否 | 有更细类目时填 | 空 | 没有就留空。 |
| 上架状态 (`status`) | 是 | 正式上架选 `发布 (publish)` | `发布 (publish)` | `草稿 (draft)` 只用于准备阶段。 |
| 标签 (`tag_csv`) | 否 | 多个标签用英文逗号分隔 | `批发 wholesale` | 不影响核心上架。 |
| 规格属性名 (`attribute_name`) | 是 | 填变体维度名称 | `重量 (Weight)` | 重量规格固定用这个。 |

## 变体 1-6

每个变体占 6 列。至少填变体 1；没有的变体整组留空。

| 字段 | 必填 | 怎么填 | 示例 | 注意 |
|---|---:|---|---|---|
| 变体 SKU (`variantN_sku`) | 变体存在时必填 | 父 SKU + 规格 | `TZ-EL-074-25g` | N 是 1-6。 |
| 变体父SKU (`variantN_parent_sku`) | 变体存在时必填 | 等于父 SKU | `TZ-EL-074` | 必须一致。 |
| 规格值 (`variantN_spec_value`) | 变体存在时必填 | 前台选项值 | `25g` | 如 `30g`、`#4`、`Small`。 |
| 美元价格 (`variantN_price_usd`) | 变体存在时必填 | 只填数字 | `0.99` | 不要填 `$`。 |
| 有货0/1 (`variantN_in_stock_0_1`) | 变体存在时必填 | `1` 有货，`0` 缺货 | `1` | 正常上架填 `1`。 |
| 变体图片 (`variantN_image_url`) | 否 | 专属图路径或 URL | 空 | 通常留空，默认用主图。 |

## 图片资产

自动化会先上传本地图片到 WP Media，再写入 Woo `images`。第一张是特色图，后面是 Product gallery。

| 字段 | 必填 | 怎么填 | 示例 | 注意 |
|---|---:|---|---|---|
| 主图路径或URL (`main_image_url`) | 是 | 本地绝对路径或线上 URL | `C:\Users\Administrator\Pictures\TZ-EL-074-main.png` | 会成为 Woo 特色图。 |
| 副图1-6 (`gallery_image_url_1` 至 `gallery_image_url_6`) | 否 | 本地绝对路径或线上 URL | `C:\path\TZ-EL-074-2.png` | 有几张填几张，按展示顺序填。 |
| 主图备份本地路径 (`local_image_path`) | 否 | 兼容旧字段 | 同主图路径 | 主图已填时可留空。 |
| 图片英文ALT (`image_alt_en`) | 是 | 简短英文描述 | `Pang San Xian bait cage` | 不要堆关键词。 |
| 图片中文ALT (`image_alt_zh`) | 是 | 简短中文描述 | `胖三弦饵笼` |  |
| 图片日文ALT (`image_alt_ja`) | 是 | 简短日文描述 | `Pang San Xian ベイトケージ` |  |
| 图片已齐备0/1 (`image_ready_0_1`) | 是 | 图片都准备好填 `1` | `1` | `0` 不能进入自动化上架。 |

## YBB 展示覆盖

这些字段决定静态前台 PDP 怎么显示，和 Woo 产品图集共同生效。

| 字段 | 必填 | 怎么填 | 推荐值 | 说明 |
|---|---:|---|---|---|
| 隐藏描述 (`hide_description_0_1`) | 是 | `0` 或 `1` | `0` | `0` 显示描述。 |
| 隐藏附加信息 (`hide_additional_info_0_1`) | 是 | `0` 或 `1` | `0` | 规格重量会显示在附加信息区。 |
| 前台隐藏 (`front_hidden_0_1`) | 是 | `0` 或 `1` | `0` | 正式上架必须 `0`。 |
| 启用图库 (`gallery_enabled_0_1`) | 是 | `0` 或 `1` | `1` | 正式上架必须 `1`。 |
| 默认图库序号 (`gallery_default_index`) | 是 | 填数字 | `0` | `0` 表示默认主图。 |
| 启用图库覆盖 (`gallery_override_enabled_0_1`) | 是 | `0` 或 `1` | `1` | 通常填 `1`。 |
| 隐藏图库序号 (`gallery_hide_indexes`) | 否 | 逗号分隔序号 | 空 | 正常留空。 |
| 英文购买区文案 (`slogan_en`) | 是 | 一句短文案 | `Stable bait hold for carp rigs.` | 购买按钮附近显示，不是描述区。 |
| 中文购买区文案 (`slogan_zh`) | 是 | 一句中文短文案 | `稳定持饵，适配欧鲤钓组。` |  |
| 日文购买区文案 (`slogan_ja`) | 是 | 一句日文短文案 | `安定したベイトホールド。` |  |
| 隐藏购买区文案 (`hide_slogan_0_1`) | 是 | `0` 或 `1` | `0` | `0` 显示 slogan。 |

## 评价可选

产品上架默认不填评价字段。评价导入有单独流程。

| 字段 | 怎么填 |
|---|---|
| 评价人 (`review_author`) | 可空。 |
| 评价邮箱 (`review_email`) | 可空。 |
| 评分1-5 (`review_rating_1_5`) | 只有填评价时选择 1-5。 |
| 评价内容 (`review_content`) | 可空。 |
| 评价日期 (`review_date_yyyy_mm_dd`) | 格式 `YYYY-MM-DD`。 |
| 评价状态 (`review_status`) | 可选 `已批准 (approved)` 或 `待审核 (hold)`。 |

## 运营备注

`ops_note` 只给内部看，不会写入前台。建议写：

- 产品资料来源；
- 是否需要人工复核翻译；
- 图片是否为最终图；
- 有无特殊价格、特殊类目、特殊隐藏要求。

## 自动化回填/验收

这些列运营不要填，由自动化或审核时回填：

- `woo_parent_id`
- `variation_wc_ids`
- `woo_publish_visible_ok`
- `woo_gallery_count`
- `product_live_rest_url`
- `product_live_rest_ok`
- `ybb_sync_status`
- `ybb_sync_build_id`
- `pdp_url`
- `frontend_i18n_ok`
- `product_sync_acceptance`
- `final_listing_state`

## 上架前检查

- `status` 是 `发布 (publish)`。
- `front_hidden_0_1` 是 `0`。
- `image_ready_0_1` 是 `1`。
- `gallery_enabled_0_1` 是 `1`。
- 至少有 1 个变体，且变体 SKU、规格、价格、有货状态完整。
- 主图路径存在；副图路径按顺序填写。
- 三语标题、三语描述、三语 slogan 都不为空。
- 描述区没有规格表、重量清单、价格清单；规格只放变体和附加信息区。
