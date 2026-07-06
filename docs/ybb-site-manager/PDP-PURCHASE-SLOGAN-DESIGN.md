# PDP 购买区 Slogan — 技术设计（POL-6）

> **方案代号：** Purchase Panel Slogan（PPS）  
> **版本：** 1.0  
> **基准 UX：** 截图红框 — `ProductPurchasePanel` 内发货承诺下方的营销段落（`product.defaultDescription`）  
> **配套实施包：** `PDP-PURCHASE-SLOGAN-IMPLEMENTATION-PACK.md`  
> **父方案：** `PRODUCT-OPS-DESIGN.md`（POL 三层模型）· `PDP-CONTENT-TABS-DESIGN.md`（PCT / POL-5，职责边界）

---

## 1. 背景与问题

### 1.1 现状

| 项 | 当前 YBB PDP 购买区 | 问题 |
|----|---------------------|------|
| 营销 slogan 段落 | `t("product.defaultDescription")` — 写死在 i18n 三语字典 | **全站 503 SKU 同文案**；运营无法按 SKU 定制 |
| 写入入口 | 改 `lib/i18n/dictionaries/*.json` | **必须 rebuild + deploy 静态包** |
| 隐藏能力 | 无 | 某些 SKU 不需要该段（如样品 / OEM 专页）无法关闭 |
| 与 Description Tab | PCT 已落地 `content.description` | 职责已分离，但 slogan 仍不可运营 |
| Quick View / Featured | 同用 `ProductPurchasePanel` | 与 PDP 行为应一致 |

**当前渲染位置（红框）：**

```
ProductPurchasePanel
  ├─ 标题 / 价 / SKU / Shop Pay
  ├─ 变体 / 数量 / 库存 / 加购 / 评价 / 发货承诺
  ├─ ★ slogan 段落  ← 本方案
  ├─ Wholesale & OEM
  └─ 分享 / View details
```

源码：`components/product/ProductPurchasePanel.tsx` L172–174：

```tsx
<p className="text-sm text-foreground/60 leading-relaxed">
  {description ?? defaultDescription}
</p>
```

### 1.2 目标

1. **Woo 后台 → YBB 站点管理** 可编辑 slogan（**全局默认 + 按 SKU 覆盖**），保存后 **无需静态 redeploy**。
2. 支持 **按 SKU 隐藏** 该段落（整段不渲染，不留空白占位）。
3. 支持 **中 / 英 / 日** 三语（与 POL 标题 / PCT 描述一致）。
4. **不破坏** PCT Description Tab、加购 / checkout、live 价链路。
5. PDP / Quick View / Featured 购买区 **语义一致**（Featured 可 Phase 2 延后接 live）。

### 1.3 非目标

- 不把 slogan bake 进 `products.json` 或静态 HTML。
- 不用 Woo `post_excerpt` / Short description 承担 slogan（与 PCT 长描述职责冲突，且多数 SKU excerpt 为空）。
- 不替换 `shipsWithin` / `wholesaleOem` 等 i18n 固定句（本 Sprint 仅 slogan 段）。
- 不做富文本 / HTML slogan（纯文本 + 换行；与购买区 `text-sm` 样式一致）。
- 不做 A/B 测试或多版本轮换。

---

## 2. 全局视角：内容分层与职责

### 2.1 PDP 右侧信息架构（全站）

```
┌─ 购买区（ProductPurchasePanel）────────────────────────────┐
│ 交易信息：价 / 变体 / 库存 / 加购 / 评价 / 发货承诺          │  Layer B live + A 静态
│ 营销 slogan（本方案 PPS）                                   │  Layer C + D + i18n fallback
│ 批发 OEM 引导（i18n 固定）                                  │  i18n
└────────────────────────────────────────────────────────────┘
┌─ 商品内容 Tab（PCT / POL-5）────────────────────────────────┐
│ Description / Additional information                       │  Layer B + C
└────────────────────────────────────────────────────────────┘
┌─ Pairs well with / Tags                                    │  Layer A
└────────────────────────────────────────────────────────────┘
```

**硬性边界（与 PCT 一致）：**

| 区块 | 数据源 | 禁止 |
|------|--------|------|
| slogan 段 | `purchaseSlogan`（REST） | 不得传入 `content.description.html` |
| Description Tab | `content.description` | 不得用 slogan 字段填充 Tab |

### 2.2 POL 扩展：四层模型

在 POL Layer A/B/C 之上增加 **Layer D — 站点级 PDP 默认文案**：

```
┌─ Layer A 静态壳 ─────────────────────────────────────────┐
│ handle, images, layout — 不含 slogan                       │
└────────────────────────────────────────────────────────────┘
┌─ Layer B Woo 真源 ─────────────────────────────────────────┐
│ 价 / 库存 / 变体 / Woo Description（给 PCT，非 slogan）      │
└────────────────────────────────────────────────────────────┘
┌─ Layer C 按 SKU 覆盖 ──────────────────────────────────────┐
│ sloganEn / sloganZh / sloganJa / hideSlogan                 │
│ 写入：YBB 站点管理 → 产品 Tab 行                             │
└────────────────────────────────────────────────────────────┘
┌─ Layer D 全站默认 ─────────────────────────────────────────┐
│ defaultSlogan.en / zh / ja / hideDefaultSloganGlobally       │
│ 写入：YBB 站点管理 → 产品 Tab 顶部「全站默认」区块              │
└────────────────────────────────────────────────────────────┘
┌─ Layer i18n 代码兜底 ──────────────────────────────────────┐
│ product.defaultDescription（三语字典）                       │
│ 仅当 C/D 均未配置时使用；改字典仍需 deploy                    │
└────────────────────────────────────────────────────────────┘
```

### 2.3 字段归属矩阵

| 字段 | Layer | 写入入口 | 前台读取 | 需 deploy |
|------|-------|----------|----------|-----------|
| `sloganEn/Zh/Ja`（per-SKU） | C | 站点管理 → 产品 Tab | `product-overrides/{handle}` | 否 |
| `hideSlogan`（per-SKU） | C | 同上 | 同上 | 否 |
| `defaultSlogan.*`（全站） | D | 站点管理 → 产品 Tab 顶部 | PHP 合并进 live payload | 否 |
| `hideDefaultSloganGlobally` | D | 同上 | 同上 | 否 |
| `product.defaultDescription` | i18n | 代码字典 | 前端 fallback | **是** |

### 2.4 前台消费点矩阵

| 入口 | 当前 slogan 来源 | PPS 后 |
|------|------------------|--------|
| **PDP** `ProductDetail` | i18n | `useProductLive` → `live.purchaseSlogan` |
| **Quick View** | i18n | 接入 `useProductLive`（或同 handle 单次 fetch） |
| **Featured** 首页 | i18n | Phase 2：可选 `fetchProductLive`；MVP 可暂留 i18n |
| **列表卡片** | 无 slogan | 不变 |

---

## 3. 文案解析规则（核心算法）

### 3.1 按语言取文案

对 locale `L ∈ {en, zh, ja}`，按 **优先级** 取第一个非空（trim 后）字符串：

```
text(L) = coalesce(
  override[`slogan${L}`],           // Layer C，如 sloganEn
  global.defaultSlogan[L],           // Layer D
  null                               // 不在 PHP 填 i18n；交给前端 fallback
)
```

前端最终展示：

```
displayText = text(L) ?? t("product.defaultDescription")
```

### 3.2 可见性 `visible`

PHP 在 `ybb_sm_product_purchase_slogan_payload()` 内计算：

```
if override.hideSlogan:
    visible = false
elif any(text(L) non-empty for L in en,zh,ja):
    visible = true
elif global.hideDefaultSloganGlobally:
    visible = false
else:
    visible = true   // 走 i18n fallback，除非运营显式全局隐藏
```

**说明：**

- **按 SKU 隐藏**优先级最高 — 整段 DOM 移除。
- 配置了任一语言自定义文案 → 强制显示（除非 hideSlogan）。
- 未配置自定义文案且 **全局隐藏** → 不显示（含 i18n fallback）。
- 未配置且未全局隐藏 → 显示 i18n 默认句（与现网一致）。

### 3.3 与 PCT `description` 的区别

| 维度 | purchaseSlogan | content.description |
|------|----------------|---------------------|
| 位置 | 购买区右侧 | 图下方 Tab |
| 英文来源 | 运营自定义 / 全局默认 / i18n | Woo `post_content` |
| 格式 | 纯文本 | HTML |
| 典型用途 | 1–2 句营销 / 场景句 | 长描述 / 规格叙述 |
| 隐藏开关 | `hideSlogan` | `hideDescription` |

---

## 4. REST 契约

Base（不变）：

```
/index.php?rest_route=/ybb/v1/site-manager/product-overrides/{handle}&_={timestamp}
```

### 4.1 GET `product-overrides/{handle}` — 扩展

在现有 `content` 同级增加 `purchaseSlogan`（**不**放入 `content`，避免 Tab 组件误用）：

```json
{
  "handle": "tz-xp-053",
  "wcId": 50890,
  "titles": { "en": "Hooklink Box A128B", "zh": "…", "ja": "…" },
  "price": 1.99,
  "available": true,
  "variants": [],
  "frontHidden": false,
  "content": {
    "description": { "visible": true, "html": { "en": "…", "zh": "…", "ja": "…" } },
    "additionalInfo": { "visible": true, "rows": [] }
  },
  "purchaseSlogan": {
    "visible": true,
    "text": {
      "en": "Precision terminal tackle in retail-ready packaging — …",
      "zh": "零售级包装精密终端钓具 — …",
      "ja": "小売向けパッケージの精密ターミナルタックル — …"
    }
  },
  "syncedAt": "2026-07-01T08:00:00Z"
}
```

**`text` 字段语义：**

- PHP 已合并 Layer C + D；**未配置的语言键可为 `""`**。
- 前端对空字符串回退 i18n（仅当 `visible === true`）。

### 4.2 GET `product-overrides`（bulk）

`overrides[handle]` 增加（供列表 / 后台索引，可选精简）：

```json
{
  "sloganEn": "",
  "sloganZh": "定制中文 slogan",
  "sloganJa": "",
  "hideSlogan": false
}
```

全站默认 **不**放入 bulk（避免 503 重复）；单独读 settings 模块（见 4.3）。

### 4.3 站点管理 settings — Layer D

存入现有 `ybb_site_manager_settings` 的 `pdp` 模块（与 `home` / `products` 并列）：

```json
{
  "pdp": {
    "enabled": true,
    "defaultSlogan": {
      "en": "Precision terminal tackle in retail-ready packaging — …",
      "zh": "零售级包装精密终端钓具 — …",
      "ja": "小売向けパッケージの…"
    },
    "hideDefaultSloganGlobally": false
  }
}
```

**REST（可选 Phase 1.5）：** `GET /ybb/v1/site-manager/pdp-settings` — 仅 Admin 或调试；**MVP 不必单独暴露**，global 仅在 PHP 合并时读取。

---

## 5. Woo / 站点管理后台 UX

### 5.1 产品 Tab — 全站默认区块（表格上方）

```
┌─ 全站购买区 Slogan 默认 ─────────────────────────────────────┐
│ [启用] 启用全站默认 slogan（留空则前台用 i18n 字典）            │
│ 英文 [textarea]  中文 [textarea]  日文 [textarea]              │
│ [ ] 全局隐藏 slogan（无 SKU 级自定义时，全站不显示该段）         │
│ 说明：SKU 行内填写可覆盖；勾选「隐藏 slogan」仅作用于该行。        │
└──────────────────────────────────────────────────────────────┘
```

### 5.2 产品 Tab — 每 SKU 列扩展

在现有 `hideAdditionalInfo` / `frontHidden` 之间插入：

| 列名 | 字段 | 控件 |
|------|------|------|
| 购买区 slogan（英） | `sloganEn` | textarea 2 行 |
| 购买区 slogan（中） | `sloganZh` | textarea 2 行 |
| 购买区 slogan（日） | `sloganJa` | textarea 2 行 |
| 隐藏 slogan | `hideSlogan` | checkbox |

**placeholder：** `留空则用全站默认 → i18n`

### 5.3 sanitize 规则

- 纯文本：`wp_strip_all_tags` + `sanitize_textarea_field`（允许 `\n`，禁止 HTML）。
- 空行合并：保存前 `trim`。
- override 行若仅 `hideSlogan` 且无其它 override 字段 → **仍保留**该行（与 `frontHidden`-only 一致）。
- 清除 override：所有 slogan 空 + hideSlogan false + 无其它 override → `unset($overrides[$handle])`。

---

## 6. 前端设计

### 6.1 类型扩展

`lib/site-manager/product-overrides-api.ts`：

```ts
export type PurchaseSloganPayload = {
  visible: boolean;
  text: { en: string; zh: string; ja: string };
};

export type ProductLiveResponse = {
  // …existing
  purchaseSlogan?: PurchaseSloganPayload;
};
```

### 6.2 解析 helper

`lib/site-manager/purchase-slogan.ts`（新）：

```ts
export function resolvePurchaseSlogan(
  payload: PurchaseSloganPayload | undefined,
  locale: Locale,
  i18nFallback: string
): { visible: boolean; text: string }
```

### 6.3 组件改动

**`ProductPurchasePanel`**

- 新增 prop：`purchaseSlogan?: { visible: boolean; text: string }`（已解析）
- 当 `visible === false` → **不渲染** slogan `<p>`
- 移除对裸 `description` prop 的隐式语义（deprecated：`description` 仅 Featured 临时兼容）

**`ProductDetail`**

```tsx
const slogan = useMemo(
  () => resolvePurchaseSlogan(live?.purchaseSlogan, locale, t("product.defaultDescription")),
  [live?.purchaseSlogan, locale, t]
);
<ProductPurchasePanel … purchaseSlogan={slogan} />
```

**`ProductQuickViewModal`**

- 接入 `useProductLive(product)`（与 PDP 同链路）

### 6.4 首屏与性能

- slogan 随 `fetchProductLive` **同请求**返回 — **零额外 RTT**。
- 首屏：在 live 未返回前 **可**显示 i18n fallback（与 live 价策略一致）；live 返回后若 `visible: false` 则移除段落。
- 可选优化：sessionStorage 缓存 `purchaseSlogan`（与 live summary cache 同 TTL）— **非 MVP**。

---

## 7. PHP 实现要点

### 7.1 新函数

| 函数 | 职责 |
|------|------|
| `ybb_sm_pdp_settings()` | 读/写 Layer D defaults |
| `ybb_sm_product_purchase_slogan_payload($override)` | 合并 C+D → REST shape |
| `ybb_sm_pdp_sanitize()` | settings sanitize |

### 7.2 修改点

| 文件 | 变更 |
|------|------|
| `includes/modules/products.php` | defaults / normalize / live payload / public overrides |
| `includes/modules/pdp.php` | **NEW** Layer D 模块 |
| `includes/class-sanitize.php` | products overrides + pdp module |
| `includes/admin/tab-products.php` | 全局区块 + 表格列 |
| `includes/admin/page.php` | sanitize 注册 `pdp` |
| `includes/modules/audit-log.php` | diff 新字段 |
| `includes/modules/product-index.php` | `hasOverride` 判定 |
| `ybb-site-manager.php` | Version → **1.7.0** |

### 7.3 种子数据

首次启用时 Layer D 默认 **留空**（前台行为 = 现网 i18n）。可选 seed 脚本把当前三语字典写入 `defaultSlogan`（一次性迁移，非必须）。

---

## 8. 验收标准

| # | 场景 | 预期 |
|---|------|------|
| 1 | 未配置任何 override / global | 显示 i18n `defaultDescription`（与现网一致） |
| 2 | 全站默认填中文，SKU 留空 | 中文站显示全站中文；英文站显示全站英文或 fallback |
| 3 | SKU 填 `sloganEn` 覆盖 | 仅该 SKU EN 变化，其它 SKU 不变 |
| 4 | SKU 勾选 `hideSlogan` | 该 SKU PDP 无 slogan 段 |
| 5 | 全局「隐藏 slogan」且无 SKU 文案 | 全站无 slogan 段 |
| 6 | 改后台保存 | 硬刷新 PDP ≤1s 生效，**无 redeploy** |
| 7 | PCT Description Tab | 不受 slogan 字段影响 |
| 8 | 加购 → checkout | 0 回归 |

**试点 SKU：** `tz-xp-053`（截图商品 Hooklink Box A128B）

---

## 9. 风险与对策

| 风险 | 对策 |
|------|------|
| 运营把 slogan 与 Description 混淆 | Admin 列名明确「购买区 slogan」；文档 + placeholder |
| 产品 Tab 列过多 | 全局块 + 4 列；后续可折叠「高级覆盖」 |
| Quick View 未接 live | Sprint 必做 `useProductLive` |
| 表格横向滚动 | 与 PCT 列同样用 `widefat` + 说明文档 |
| i18n 与 global 双源 | 解析顺序文档化 + 验收脚本断言 |

---

## 10. 版本与依赖

| 项 | 值 |
|----|-----|
| mu-plugin | **1.7.0**（依赖 PCT **1.6.0+**） |
| 前端 | 需 **build + deploy** 一次（组件接 REST）；之后运营改 slogan **无需 redeploy** |
| 父文档 | `PRODUCT-OPS-DESIGN.md` · `PDP-CONTENT-TABS-DESIGN.md` |

---

## 11. 相关文件索引

| 用途 | 路径 |
|------|------|
| 购买区组件 | `components/product/ProductPurchasePanel.tsx` |
| PDP 入口 | `components/product/ProductDetail.tsx` |
| Live hook | `hooks/useProductLive.ts` |
| REST 类型 | `lib/site-manager/product-overrides-api.ts` |
| i18n 默认句 | `lib/i18n/dictionaries/{en,zh,ja}.json` → `product.defaultDescription` |
| mu-plugin 产品模块 | `deploy/wp-content/mu-plugins/ybb-site-manager/includes/modules/products.php` |
| 产品 Tab | `deploy/wp-content/mu-plugins/ybb-site-manager/includes/admin/tab-products.php` |
