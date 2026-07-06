# PDP 商品描述与附加信息 — 技术设计（POL-5）

> **方案代号：** PDP Content Tabs（PCT）  
> **版本：** 1.0  
> **基准站：** [carpzoom.com 商品 PDP](https://carpzoom.com/product/azurite-6000-long-cast-feeder-fishing-reel/)（WooCommerce `Description` + `Additional information` Tab）  
> **配套实施包：** `PDP-CONTENT-TABS-IMPLEMENTATION-PACK.md`  
> **父方案：** `PRODUCT-OPS-DESIGN.md`（POL 三层模型）

---

## 1. 背景与问题

### 1.1 现状

| 项 | 当前 YBB PDP | 问题 |
|----|--------------|------|
| 购买区段落 | `product.defaultDescription`（i18n 全站 slogan） | 非 per-SKU 商品描述，易被误认为 Description |
| Description Tab | **不存在** | 无法展示 Woo 长描述 |
| Additional information | **不存在** | 无法展示 Weight / 全局属性表 |
| 布局 | 双栏 grid 后直接 `Pairs well with` | 与 carpzoom 信息架构不一致 |
| 数据 | `products.json` / `Product` 类型无 `description`、无父级属性 | sync 未落盘；REST 未暴露 |
| 站点管理 | 产品 Tab 仅 `titleZh` / `titleJa` / `frontHidden` | 无法隐藏或覆盖描述类内容 |

### 1.2 目标

1. 全站 PDP 在 **商品图区下方、`Pairs well with` 上方** 增加 **Description** 与 **Additional information** 两个 Tab（桌面横 Tab；移动手风琴）。
2. **WooCommerce 为内容真源**；**YBB 站点管理** 提供多语覆盖与按 SKU 隐藏。
3. 改描述/属性 **无需静态 redeploy**（与 POL 价/标题一致，client fetch 即时生效）。
4. **购买区 slogan**（发货承诺、批发 OEM）职责不变，不与商品 Tab 混用。

### 1.3 非目标

- 不把 `description` / `attributes` bake 进 `products.json` 或静态 HTML。
- 不做属性筛选归档页（`/brand/xxx` 链接受控于 Phase 2）。
- 不用 Site Manager 替代 Woo 维护 SKU / 价格 / 变体结构。
- 不替换右侧 `defaultDescription` 全站营销文案（除非未来单独「全局 PDP 文案」模块）。

---

## 2. 基准分析（carpzoom）

### 2.1 DOM 结构

```html
<div class="woocommerce-tabs wc-tabs-wrapper">
  <ul class="tabs wc-tabs">
    <li class="description_tab">Description</li>
    <li class="additional_information_tab">Additional information</li>
  </ul>
  <div id="tab-description" class="woocommerce-Tabs-panel--description">…HTML…</div>
  <div id="tab-additional_information">
    <table class="woocommerce-product-attributes shop_attributes">…</table>
  </div>
</div>
```

- 内容 **首屏 SSR**，Tab 切换 **无 XHR**。
- YBB 静态站采用 **client fetch**（与 live 价同一请求），首屏可显示 skeleton。

### 2.2 数据来源

| 面板 | Woo 后台 | Store API 字段 |
|------|----------|----------------|
| Description | 产品 → Description（`post_content`） | `description`（HTML） |
| Additional information | Shipping → Weight + Attributes（全局 `pa_*`） | `formatted_weight` + `attributes[]` |

### 2.3 YBB 读取路径选型

| 方案 | 优点 | 缺点 | **选用** |
|------|------|------|----------|
| 前台直连 Store API | 少改 mu-plugin | Captcha、与现有 `product-overrides` 分裂 | 否 |
| 扩展 `product-overrides/{handle}` | 与 `useProductLive` 同请求；PHP 内 `WC_Product` 读数 | 需改 mu-plugin | **是** |

---

## 3. 架构：POL 扩展

```
┌─ Layer A 静态壳 ─────────────────────────────────────────┐
│ handle, images, collection, wcId 快照, SEO title 骨架       │
│ 不含 description / additionalInfo                          │
└────────────────────────────────────────────────────────────┘
                              │
┌─ Layer B Woo 真源 ─────────────────────────────────────────┐
│ descriptionHtml  ← get_description()                       │
│ additionalRows   ← get_attributes() + get_weight()           │
│ 写入：WooCommerce → 产品编辑                                │
└────────────────────────────────────────────────────────────┘
                              │
┌─ Layer C 站点管理覆盖 ─────────────────────────────────────┐
│ descriptionZh / descriptionJa（可选 HTML 或纯文本）           │
│ hideDescription / hideAdditionalInfo                         │
│ 写入：YBB 站点管理 → 产品 Tab                                 │
└────────────────────────────────────────────────────────────┘
```

### 3.1 字段归属矩阵

| 字段 | Layer | 写入入口 | 前台读取 | 需 deploy |
|------|-------|----------|----------|-----------|
| `description.en` | B | Woo → Description | `product-overrides/{handle}` | 否 |
| `description.zh/ja` | C | 站点管理 → 产品 | 同上 | 否 |
| `hideDescription` | C | 站点管理 | 同上 | 否 |
| `additionalInfo.rows` | B | Woo → Attributes | 同上 | 否 |
| `additionalInfo.weight` | B | Woo → Shipping | 同上 | 否 |
| `hideAdditionalInfo` | C | 站点管理 | 同上 | 否 |
| `defaultDescription`（slogan） | i18n | 代码字典 / 未来全局模块 | `ProductPurchasePanel` | 改字典需 deploy |

---

## 4. REST 契约

Base URL（不变）：

```
/index.php?rest_route=/ybb/v1/site-manager/product-overrides/{handle}&_={timestamp}
```

### 4.1 GET `product-overrides/{handle}` — 扩展响应

在现有 `titles / price / variants / frontHidden` 上增加 `content`：

```json
{
  "handle": "tz-zbsb-006-l",
  "wcId": 51234,
  "titles": { "en": "Tool Bag", "zh": "工具包", "ja": "…" },
  "price": 5.99,
  "available": true,
  "variants": [],
  "frontHidden": false,
  "content": {
    "description": {
      "visible": true,
      "html": {
        "en": "<p>Retail-grade tool bag…</p>",
        "zh": "<p>零售级工具包…</p>",
        "ja": ""
      }
    },
    "additionalInfo": {
      "visible": true,
      "rows": [
        {
          "key": "weight",
          "label": "Weight",
          "value": "0.12 kg",
          "href": null
        },
        {
          "key": "pa_brand",
          "label": "Brand",
          "value": "YBB Tackle",
          "href": "/collections/…",
          "taxonomy": "pa_brand",
          "termSlug": "ybb-tackle"
        }
      ]
    }
  },
  "syncedAt": "2026-07-01T12:00:00Z"
}
```

### 4.2 合并规则（PHP）

```text
description.html.en  = wp_kses_post( WC_Product::get_description() )
description.html.zh  = override.descriptionZh !== '' ? kses(override) : html.en
description.html.ja  = override.descriptionJa !== '' ? kses(override) : html.en
description.visible  = !override.hideDescription && strip_tags(html[locale]) !== ''

additionalInfo.rows = ybb_sm_product_additional_rows( $product )
  // 1) weight 行（若有）
  // 2) 每个 visible=true 的 attribute（taxonomy term 解析为 name）
additionalInfo.visible = !override.hideAdditionalInfo && count(rows) > 0
```

**前台 locale 选择：**

```typescript
const html = content.description.html[locale] || content.description.html.en;
```

### 4.3 GET `product-overrides`（全量）— 扩展

仅暴露覆盖相关字段（体量控制）：

```json
{
  "overrides": {
    "tz-zbsb-006-l": {
      "titleZh": "工具包",
      "titleJa": "",
      "frontHidden": false,
      "descriptionZh": "",
      "descriptionJa": "",
      "hideDescription": false,
      "hideAdditionalInfo": false
    }
  }
}
```

### 4.4 POST `product-overrides/{handle}` — 扩展 Body

**新增允许字段：**

| 字段 | 类型 | 说明 |
|------|------|------|
| `descriptionZh` | string | 可选，HTML 经 `wp_kses_post` |
| `descriptionJa` | string | 同上 |
| `hideDescription` | bool | 隐藏 Description Tab |
| `hideAdditionalInfo` | bool | 隐藏 Additional information Tab |

**仍禁止：** `sku`, `wcId`, `price`, `variants`, `descriptionEn`（英文只信 Woo）

### 4.5 PHP 辅助函数（新增）

```php
/** @return list<array{key:string,label:string,value:string,href:?string,taxonomy?:string,termSlug?:string}> */
function ybb_sm_product_additional_rows(WC_Product $product): array;

/** @return array{visible:bool,html:array{en:string,zh:string,ja:string}} */
function ybb_sm_product_description_payload(WC_Product $product, array $override): array;
```

---

## 5. WordPress / mu-plugin

### 5.1 变更文件

| 文件 | 变更 |
|------|------|
| `includes/modules/products.php` | `ybb_sm_product_live_payload` 追加 `content`；override get/save 扩展字段 |
| `includes/class-sanitize.php` | `ybb_sm_sanitize_product_override_row` |
| `includes/admin/tab-products.php` | 表格列：中文描述、隐藏开关（可折叠行内编辑） |
| `includes/modules/audit-log.php` | diff `descriptionZh` / hide 标志 |
| `includes/class-rest.php` | 无新路由（扩展现有） |
| `ybb-site-manager.php` | version **1.6.0** |

### 5.2 Settings / override 行结构

```json
{
  "tz-zbsb-006-l": {
    "titleZh": "工具包",
    "titleJa": "",
    "frontHidden": false,
    "descriptionZh": "",
    "descriptionJa": "",
    "hideDescription": false,
    "hideAdditionalInfo": false,
    "updatedAt": "2026-07-01T12:00:00Z"
  }
}
```

### 5.3 Admin UX（产品 Tab）

| 列 / 控件 | 说明 |
|-----------|------|
| 中文描述 | `<textarea rows="3">`，提示「留空则使用 Woo 英文描述」 |
| 日文描述 | 同上 |
| 隐藏 Description | checkbox |
| 隐藏 Additional info | checkbox |
| Woo 链接 | 跳转 Woo 产品编辑 → Description / Attributes |

保存行为与现有产品覆盖一致：**保存站点管理主表单 → 即时写 option → REST 立即可读**。

### 5.4 Woo 属性规范（运营约定）

建议全站统一全局属性（与 carpzoom `pa_*` 对齐）：

| 显示名 | taxonomy 建议 | 用途 |
|--------|---------------|------|
| Brand | `pa_brand` | 品牌 |
| EAN | `pa_ean` | 条码 |
| Length / 规格 | `pa_length` 或与变体 Specification 区分 | 物理尺寸 |
| Material | `pa_material` | 材质 |
| Weight（发货重） | Woo Shipping 字段 | Additional 首行，非 attribute |

---

## 6. 前端设计

### 6.1 新文件

| 路径 | 职责 |
|------|------|
| `components/product/ProductContentTabs.tsx` | Tab UI + 手风琴 + 属性表 |
| `lib/site-manager/product-content.ts` | 从 `ProductLiveResponse` 解析当前 locale 的 content |

### 6.2 变更文件

| 路径 | 变更 |
|------|------|
| `lib/site-manager/product-overrides-api.ts` | 扩展 `ProductLiveResponse`、`ProductOverrideRow` |
| `hooks/useProductLive.ts` | 无逻辑变更（类型随 API 扩展） |
| `components/product/ProductDetail.tsx` | grid 与 `PairsWellWith` 之间插入 `ProductContentTabs` |
| `lib/i18n/dictionaries/*.json` | 新增 `product.tabDescription`、`product.tabAdditionalInfo` |

### 6.3 布局（`ProductDetail.tsx`）

```tsx
<div className="grid …"> {/* 图 + 购买区 */} </div>

<ProductContentTabs
  content={live?.content}
  ready={ready}
/>

<PairsWellWith product={product} />
```

- **全宽**：`ProductContentTabs` 在 `page-container` 内、`grid` 外，与 carpzoom 一致。
- **空态**：`description.visible === false && additionalInfo.visible === false` → 整个组件 `return null`。
- **单 Tab**：仅一侧有内容时只显示一个 Tab（无空 Tab）。

### 6.4 `ProductContentTabs` 行为

| 状态 | UI |
|------|-----|
| `!ready` | 两条 skeleton 线（`aria-busy`） |
| Description | `dangerouslySetInnerHTML` 渲染 `html[locale]`；prose 样式 |
| Additional | `<table>`，`th`/`td` 与 carpzoom 语义一致 |
| Mobile (`max-md`) | 手风琴：标题可点击展开（参考 Ochaka `pls-tab-contents`） |
| Desktop | 横 Tab + 底边激活线（`border-b-2 border-foreground`） |

### 6.5 与 `ProductPurchasePanel` 边界

| 区域 | 组件 | 内容来源 |
|------|------|----------|
| 购买区营销段 | `ProductPurchasePanel` | `t("product.defaultDescription")` + shipsWithin + wholesaleOem |
| 商品描述 Tab | `ProductContentTabs` | Woo + override |
| 附加信息 Tab | `ProductContentTabs` | Woo attributes + weight |

**禁止**将 `live.content.description` 传入 `ProductPurchasePanel.description` prop。

### 6.6 类型扩展（TypeScript）

```typescript
export type ProductAdditionalRow = {
  key: string;
  label: string;
  value: string;
  href?: string | null;
  taxonomy?: string;
  termSlug?: string;
};

export type ProductContentPayload = {
  description: {
    visible: boolean;
    html: { en: string; zh: string; ja: string };
  };
  additionalInfo: {
    visible: boolean;
    rows: ProductAdditionalRow[];
  };
};

// ProductLiveResponse 增加:
// content?: ProductContentPayload;
```

---

## 7. 安全

| 项 | 措施 |
|----|------|
| 描述 HTML XSS | PHP `wp_kses_post`；禁止 override 内 `<script>` |
| REST 公开读 | 与现有 product-overrides 相同（仅展示已发布商品内容） |
| POST 权限 | `manage_options` |

---

## 8. 性能

| 项 | 策略 |
|----|------|
| 请求数 | **零新增**：并入现有 `fetchProductLive(handle)` |
| Payload | 单商品 description 通常 <4KB；489 SKU 不批量拉 content |
| 缓存 | 可选 `sessionStorage` key `ybb:pdp-content:{handle}` TTL 60s（与 live 价一致，S5 可选） |

---

## 9. 测试矩阵

| 场景 | 期望 |
|------|------|
| Woo 有 Description + Attributes | 两 Tab 显示，文案与后台一致 |
| Woo Description 空 | 仅 Additional Tab（若 rows 非空） |
| 两者皆空 | 整块不渲染 |
| override `descriptionZh` | 中文 locale 显示中文 HTML |
| `hideAdditionalInfo` | Additional Tab 隐藏 |
| 改 Woo Description 保存 | 硬刷新 PDP → 新文案（无 redeploy） |
| 右侧 slogan | 仍为 `defaultDescription`，不变 |
| Tab 位置 | 在 `Pairs well with` 上方 |
| 加购 / checkout | 回归不受影响 |

---

## 10. 风险与缓解

| 风险 | 缓解 |
|------|------|
| 大量 SKU 无描述 | 空不渲染；运营分批在 Woo 补；可用上架脚本写 Description |
| 属性命名混乱 | 文档 + Woo 全局属性模板；Admin 提示链接 |
| HTML 样式脏 | Woo 编辑器限制；前台 `prose` 重置列表/段落 |
| mu-plugin 未上传 | 与 POL 相同：`upload-ybb-site-manager.py` |

---

## 11. 版本与依赖

| 项 | 要求 |
|----|------|
| ybb-site-manager | ≥ **1.6.0**（PCT） |
| 前置 POL | S2 `useProductLive` 已上线 |
| WooCommerce | 已有 Store API / `WC_Product` |
| 静态站 | 需 deploy **前端** JS/CSS 一次；之后内容改无需 redeploy |

---

## 12. 参考

- 基准爬取：`reports/carpzoom-product.html`、`reports/carpzoom-product-wc-store.json`
- POL 主设计：`PRODUCT-OPS-DESIGN.md`
- REST：`REST-SPEC.md` § POL / PCT
- 运营：`OPS-RUNBOOK-zh.md`（PCT 章节，实施包 S5-06 增补）
