# PDP 分期提示条（Shop Pay Installments）— 技术设计（POL-7）

> **方案代号：** Shop Pay Installments Banner（SPI）  
> **版本：** 1.0  
> **基准 UX：** 当前 `ProductPurchasePanel` 价格下方紫色条 — `Pay in 3 interest-free instalments of $0.16 with shop Shop Pay`  
> **配套实施包：** `PDP-SHOPPAY-INSTALLMENTS-IMPLEMENTATION-PACK.md`  
> **配套测试：** `PDP-SHOPPAY-INSTALLMENTS-TEST-CASES.md`  
> **父方案：** `PRODUCT-OPS-DESIGN.md`（POL 三层模型）· `PDP-PURCHASE-SLOGAN-DESIGN.md`（PPS / POL-6，职责边界）

---

## 1. 背景与问题

### 1.1 现状

| 项 | 当前 YBB PDP | 问题 |
|----|--------------|------|
| 分期提示条 | `ShopPayInstallment.tsx` 硬编码英文模板 | **全站所有 PDP 强制显示**；运营无法改文案、关开关、改期数 |
| 金额 `{amount}` | `formatInstallmentPrice(price / 3)` | 随 live 价自动变（正确）；但期数 `3` 写死 |
| 多语言 | 仅英文 | 中文/日文站点仍显示英文 Shop Pay 句 |
| 写入入口 | 改 React 组件 + `npm run build` + deploy | **每次改文案都要静态部署** |
| 与 Woo | 无关联 | Woo 产品页无对应字段；也不应 per-SKU 维护同一句模板 |
| 与 purchaseSlogan | 独立区块 | 不混淆（slogan 在加购下方；分期条在价格下方） |

**当前渲染位置：**

```
ProductPurchasePanel
  ├─ 标题 / 价 / SKU
  ├─ ★ Shop Pay 分期条  ← 本方案（SPI）
  ├─ 变体 / 数量 / 库存 / 加购
  ├─ purchaseSlogan（PPS / POL-6）
  └─ Wholesale & OEM / 分享
```

源码：`components/product/ProductPurchasePanel.tsx` L116：

```tsx
<ShopPayInstallment price={product.price} />
```

组件文案：`components/product/ShopPayInstallment.tsx` L15–22（全硬编码）。

### 1.2 目标

1. **YBB 站点管理 → 产品 Tab** 可配置全站分期提示条（开关、期数、三语模板、最低展示价），保存后 **无需静态 redeploy**。
2. 支持 **按 SKU 隐藏** 分期条（样品页 / OEM 专页等）。
3. `{amount}` 仍由 **live 价 ÷ 期数** 在前端计算；变体切换时自动更新。
4. **不破坏** PPS slogan、PCT Description Tab、加购 / checkout、live 价链路。
5. PDP / Quick View **行为一致**。

### 1.3 非目标

- 不把分期文案 bake 进 `products.json` 或静态 HTML。
- 不在 Woo 单个产品编辑页增加 custom field（维护成本高；全站模板放 Layer D）。
- 不接入真实 Shop Pay / Klarna / Affirm API（本方案仅 **展示层**；支付能力由 Woo 网关决定）。
- 不做富文本 / HTML 模板（纯文本 + 占位符；样式仍由前端组件控制）。
- 不在列表卡片 / 首页 Featured 显示分期条（仅购买区）。

### 1.4 业务合规提醒

carp-ybb 为 **WooCommerce 独立站**，非 Shopify。若 checkout **未** 接入 Shop Pay 分期，运营应：

- 将 `enabled` 设为 `false`，或
- 将模板改为中性句（如 `Flexible payment options available at checkout`），或
- 改用已接入网关名称（PayPal 等）。

**产品 / 法务应在上线前确认展示文案与真实支付能力一致。**

---

## 2. 全局视角：内容分层与职责

### 2.1 PDP 购买区信息架构（SPI 位置）

```
┌─ 购买区（ProductPurchasePanel）────────────────────────────┐
│ 交易：价 / SKU                                              │  Layer B live
│ ★ 分期提示条 SPI（本方案）                                   │  Layer D + C + i18n fallback
│ 变体 / 加购 / 库存                                          │  Layer B
│ purchaseSlogan PPS（POL-6）                                 │  Layer C/D
│ 批发 OEM（i18n 固定）                                       │  i18n
└────────────────────────────────────────────────────────────┘
```

**硬性边界：**

| 区块 | 数据源 | 禁止 |
|------|--------|------|
| 分期提示条 | `shopPayInstallments`（REST） | 不得写入 `purchaseSlogan` / `content.description` |
| purchaseSlogan | `purchaseSlogan`（REST） | 不得用 slogan 字段填分期条 |
| Description Tab | `content.description` | 不变 |

### 2.2 POL 扩展

在现有 Layer D（`products.pdp`）上扩展，与 `defaultSlogan` 同级：

```
┌─ Layer D 全站 PDP 设置（products.pdp）─────────────────────┐
│ shopPayInstallments.enabled                                 │
│ shopPayInstallments.installmentCount                        │
│ shopPayInstallments.minPriceUsd                             │
│ shopPayInstallments.template.en / zh / ja                     │
│ shopPayInstallments.hideGlobally（= enabled 的反义或独立字段） │
└────────────────────────────────────────────────────────────┘
┌─ Layer C 按 SKU 覆盖 ──────────────────────────────────────┐
│ hideShopPayInstallments（bool）                               │
└────────────────────────────────────────────────────────────┘
┌─ Layer i18n 代码兜底 ──────────────────────────────────────┐
│ product.shopPayInstallmentTemplate（三语，含 {amount}{count}）│
│ 仅当 Layer D 模板为空时使用；改字典需 deploy                  │
└────────────────────────────────────────────────────────────┘
```

### 2.3 字段归属矩阵

| 字段 | Layer | 写入入口 | 前台读取 | 需 deploy |
|------|-------|----------|----------|-----------|
| `shopPayInstallments.*`（全站） | D | 站点管理 → 产品 Tab 顶部 | `product-live/{handle}` | 否 |
| `hideShopPayInstallments` | C | 站点管理 → 产品 Tab 行 | 同上 | 否 |
| `product.shopPayInstallmentTemplate` | i18n | `dictionaries/*.json` | 前端 fallback | **是** |
| `{amount}` 计算 | B | — | 前端 `formatPrice(price/count)` | 否 |
| Shop Pay 视觉样式 | 代码 | `ShopPayInstallment.tsx` | CSS 组件 | **是**（仅改样式时） |

---

## 3. 文案与可见性算法

### 3.1 模板占位符

| 占位符 | 含义 | 计算方 |
|--------|------|--------|
| `{amount}` | 每期金额（含货币符号） | 前端 `formatInstallmentPrice(price, count)` |
| `{count}` | 分期期数 | Layer D `installmentCount`（默认 3，范围 2–12） |
| `{total}` | 商品当前价（可选，MVP 可不支持） | 前端 `formatPrice(price)` |

**模板示例（英文）：**

```
Pay in {count} interest-free instalments of {amount} with Shop Pay
```

**模板示例（中文）：**

```
分 {count} 期免息付款，每期 {amount}，支持 Shop Pay
```

**sanitize 规则（PHP）：**

- `wp_strip_all_tags` + `sanitize_textarea_field`
- 允许占位符 `{amount}` `{count}` `{total}`；其它 `{...}` 原样保留或 strip（实现时统一 whitelist）

### 3.2 可见性 `visible`

PHP 在 `ybb_sm_product_shop_pay_installments_payload($override, $price)` 内计算：

```
if override.hideShopPayInstallments:
    visible = false
elif global.enabled == false OR global.hideGlobally:
    visible = false
elif price > 0 AND price < global.minPriceUsd:
    visible = false   // minPriceUsd=0 表示不限制
elif resolvedTemplate(en) == "" AND resolvedTemplate(zh) == "" AND resolvedTemplate(ja) == "":
    visible = false
else:
    visible = true
```

前端 **二次校验**（防御 stale cache）：

```
if payload.visible === false → 不渲染
if price <= 0 → 不渲染
```

### 3.3 按语言取模板

对 locale `L ∈ {en, zh, ja}`：

```
template(L) = coalesce(
  global.shopPayInstallments.template[L],   // Layer D
  null                                       // 交给前端 i18n fallback
)
```

前端渲染：

```
displayTemplate = template(L) ?? t("product.shopPayInstallmentTemplate")
displayText = interpolate(displayTemplate, { amount, count, total })
```

`interpolate` 为纯字符串 replace，**不** eval。

---

## 4. REST 契约

### 4.1 扩展 `GET /ybb/v1/site-manager/product-live/{handle}`

在现有 `product-live` 响应根级增加（与 `purchaseSlogan` 同级）：

```json
{
  "handle": "tz-qz-013",
  "price": 0.49,
  "shopPayInstallments": {
    "visible": true,
    "installmentCount": 3,
    "minPriceUsd": 0,
    "template": {
      "en": "Pay in {count} interest-free instalments of {amount} with Shop Pay",
      "zh": "分 {count} 期免息付款，每期 {amount}，支持 Shop Pay",
      "ja": "{count}回の無利息分割払い、各回 {amount}（Shop Pay）"
    },
    "resolved": {
      "en": "Pay in 3 interest-free instalments of $0.16 with Shop Pay",
      "zh": "分 3 期免息付款，每期 $0.16，支持 Shop Pay",
      "ja": "3回の無利息分割払い、各回 $0.16（Shop Pay）"
    }
  }
}
```

**设计选择：**

| 方案 | 说明 | 选用 |
|------|------|------|
| 仅返回 `template` + `installmentCount`，前端 interpolate | 变体切换时前端重算 `{amount}` | **是（MVP）** |
| PHP 预填 `resolved.*` | 便于 curl 验收；变体切换仍以前端为准 | **可选**（验收友好，与 template 并存） |

MVP 推荐：**同时返回 `template` + `installmentCount` + `visible`**；`resolved` 由 PHP 按 **默认变体价** 预填，供运营 curl 快验；PDP 客户端以 **当前选中变体价** 重算 `{amount}`。

### 4.2 扩展 `GET /ybb/v1/site-manager/product-overrides/{handle}`

公开读接口同步返回 `shopPayInstallments` shape（与 live 一致），便于调试。

### 4.3 扩展 `POST /ybb/v1/site-manager/product-overrides/{handle}`

新增可写字段：

| 字段 | 类型 | 说明 |
|------|------|------|
| `hideShopPayInstallments` | bool | SKU 级隐藏 |

全站设置走现有 **站点管理保存**（`products.pdp.shopPayInstallments`），非 per-handle POST。

### 4.4 扩展 Layer D 存储结构

写入 `ybb_site_manager_settings.products.pdp`：

```json
{
  "defaultSlogan": { "...": "..." },
  "shopPayInstallments": {
    "enabled": true,
    "installmentCount": 3,
    "minPriceUsd": 0,
    "template": {
      "en": "Pay in {count} interest-free instalments of {amount} with Shop Pay",
      "zh": "",
      "ja": ""
    }
  }
}
```

---

## 5. 前端设计

### 5.1 类型（`product-overrides-api.ts`）

```ts
export type ShopPayInstallmentsPayload = {
  visible: boolean;
  installmentCount: number;
  minPriceUsd?: number;
  template: { en: string; zh: string; ja: string };
  resolved?: { en: string; zh: string; ja: string };
};
```

`ProductLiveResponse` 增加 `shopPayInstallments?: ShopPayInstallmentsPayload`。

### 5.2 解析 helper（新文件 `lib/site-manager/shop-pay-installments.ts`）

```ts
export function resolveShopPayInstallmentText(
  payload: ShopPayInstallmentsPayload | undefined,
  locale: Locale,
  price: number,
  i18nTemplate: string
): { visible: boolean; text: string; count: number } | null;

export function interpolateInstallmentTemplate(
  template: string,
  vars: { amount: string; count: number; total: string }
): string;
```

### 5.3 组件改造

**`ShopPayInstallment.tsx`：**

- Props 改为 `{ price, payload, locale }` 或 `{ price, text, visible }`（由父组件 resolve）
- 移除硬编码英文字符串
- 保留现有紫色 UI 壳；`shop` badge + `Shop Pay` 品牌色 **仍由组件渲染**（模板只负责句子，不含 HTML）

**`ProductPurchasePanel.tsx`：**

```tsx
const installment = resolveShopPayInstallmentText(
  live?.shopPayInstallments,
  locale,
  product.price,
  t("product.shopPayInstallmentTemplate")
);
// ...
{installment?.visible && (
  <ShopPayInstallment text={installment.text} />
)}
```

**`ProductDetail.tsx` / `ProductQuickViewModal.tsx`：**

- 从 `useProductLive` 传入 `live.shopPayInstallments`
- 变体切换时 `product.price` 变化 → `{amount}` 自动重算

### 5.4 缓存

与 `useProductLive` 共用 `product-live` sessionStorage（TTL 5min）。  
后台改模板后，`syncedAt` 或 template 字段变化应触发 cache stale（复用现有 `isLiveCacheStale` 逻辑，扩展比对 `shopPayInstallments.template.en`）。

---

## 6. 后台 Admin UX

### 6.1 产品 Tab 顶部 —「全站 PDP 设置」区块（扩展现有 PPS 区块下方）

| 控件 | 字段 | 说明 |
|------|------|------|
| 复选框 | `shopPayInstallments.enabled` | 全站启用分期提示条 |
| 数字 | `installmentCount` | 2–12，默认 3 |
| 数字 | `minPriceUsd` | 低于此价不展示；0=不限 |
| 文本域 ×3 | `template.en/zh/ja` | 支持 `{amount}` `{count}`；留空则用代码字典 |
| 说明 | — | 占位符说明 + 合规提示（Shop Pay 需与实际支付一致） |

### 6.2 产品 Tab 表格 — 每 SKU 新增列

| 列 | 字段 | 说明 |
|----|------|------|
| 隐藏分期条 | `hideShopPayInstallments` | 勾选后该 SKU 不显示 |

### 6.3 audit-log

记录变更：`shopPayInstallments.enabled`、`installmentCount`、`template.*`、`hideShopPayInstallments`。

---

## 7. 部署与运维

### 7.1 一次性 vs 持续

| 变更类型 | 需 mu-plugin | 需静态 deploy |
|----------|--------------|---------------|
| 首次 SPI 功能上线 | 是 | **是**（改 React） |
| 运营改模板 / 开关 / 期数 | 否（仅保存设置） | **否** |
| 运营 hide 某 SKU | 否 | **否** |
| 改 i18n 兜底模板 | 否 | **是** |
| 改紫色 UI 样式 | 否 | **是** |

### 7.2 部署顺序

1. mu-plugin（SPI 字段 + REST）→ curl 验收  
2. 前端 build + sync 部署机 + SiteGround  
3. `product-shop-pay-installments-acceptance.py`  
4. 运营在站点管理填模板 / 关开关 → 硬刷新 PDP 验收  

### 7.3 验收 curl

```powershell
$t=[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
curl.exe -sS "https://carp-ybb.com/wp-json/ybb/v1/site-manager/product-live/tz-qz-013?_=$t"
# 检查 shopPayInstallments.visible / template / resolved.en
```

---

## 8. 风险与缓解

| 风险 | 缓解 |
|------|------|
| 展示 Shop Pay 但未接入 | 文档 + Admin 合规提示；默认 enabled=false 直到运营确认 |
| 模板 typo 破坏占位符 | sanitize + 前端 missing placeholder 时 fallback 显示 `{amount}` 字面 |
| 旧 mu-plugin 无字段 | 前端 `payload?.visible === undefined` → 回退 i18n 硬编码行为（兼容期） |
| 多货币 | MVP 仅 USD；`formatPrice` 已跟 Woo 货币设置 |
| 与 PPS 混淆 | 分区文档 + Admin 区块标题区分 |

---

## 9. 版本与依赖

| 项 | 值 |
|----|-----|
| mu-plugin 目标版本 | **1.9.0**（SPI） |
| 前置 | PPS 1.7+ / PCT 1.6+ 已上线 |
| 试点 SKU | `tz-qz-013`（$0.49 变体，amount≈$0.16） |
| 对照 SKU | `tz-el-074`（hide 场景） |

---

## 10. 交叉引用

| 文档 | 变更 |
|------|------|
| `PDP-PURCHASE-SLOGAN-DESIGN.md` §2.1 | 增补 SPI 与 PPS 职责分界 |
| `PRODUCT-OPS-DESIGN.md` 字段矩阵 | 增补 `shopPayInstallments` |
| `REST-SPEC.md` | 增补 `shopPayInstallments` schema |
| `OPS-RUNBOOK-zh.md` | 增补运营改分期条说明 |
