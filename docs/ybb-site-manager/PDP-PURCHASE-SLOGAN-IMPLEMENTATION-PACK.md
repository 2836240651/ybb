# PDP 购买区 Slogan — PRD & 实施包（POL-6 / PPS）

> **配套技术设计：** `PDP-PURCHASE-SLOGAN-DESIGN.md`  
> **前置：** PCT / POL-5 已上线（mu-plugin **1.6.0**）  
> **建议工期：** 0.5–1 Sprint（2–3 人日，1 人）  
> **mu-plugin 目标版本：** **1.7.0**  
> **试点 SKU：** `tz-xp-053`（Hooklink Box A128B）

---

## PRD 摘要

### 背景

PDP 购买区右侧营销 slogan（红框段落）目前写死在 Next i18n 字典 `product.defaultDescription`，全站 503 SKU 共用一句，运营无法按商品定制或隐藏。PCT 已把 **Description Tab** 与购买区职责分开；本 Sprint 补齐 **购买区 slogan** 的可运营能力。

### 用户故事

| 角色 | 故事 | 验收 |
|------|------|------|
| **运营** | 在站点管理设置全站默认 slogan（三语） | 保存后任意 PDP 硬刷新可见 |
| **运营** | 为单个 SKU 写专属 slogan 或隐藏该段 | `tz-xp-053` 与其它 SKU 表现不同 |
| **运营** | 改 slogan 后不重新部署静态包 | 仅上传 mu-plugin + 一次前端 deploy 后，后续改文案无 redeploy |
| **买家** | 购买区文案与商品匹配 | 不影响 Description Tab / 加购 |
| **开发** | 不增加 REST 往返 | `purchaseSlogan` 并入现有 `product-overrides/{handle}` |

### 范围（In）

- Layer D 全站默认 + Layer C 按 SKU 覆盖 + 隐藏
- mu-plugin REST / sanitize / Admin 产品 Tab
- 前端 `ProductPurchasePanel` / `ProductDetail` / `ProductQuickViewModal`
- 验收脚本 `product-purchase-slogan-acceptance.py`
- REST-SPEC / OPS runbook 增补

### 非目标（Out）

- Featured 首页区块接 live（可 S6-optional）
- slogan 富文本 / HTML
- 把 slogan 同步进 `products.json`
- 修改 `shipsWithin` / `wholesaleOem` 文案

### 成功指标

| 指标 | 目标 |
|------|------|
| 后台改 slogan → PDP 更新 | 硬刷新即时 |
| 隐藏 slogan | DOM 无该 `<p>` |
| PCT / checkout 回归 | 0 回归 |
| 试点 SKU 三场景 | 3/3 PASS |

---

## Sprint 总览

| Sprint | 代号 | 目标 | 可独立上线 |
|--------|------|------|------------|
| **S6** | **PPS / POL-6** | 购买区 slogan 可编辑可隐藏 | **是**（mu-plugin 先上，前端随后） |

**推荐顺序：** S6-01 → S6-02 → … → S6-06（PHP）→ 上传 mu-plugin → S6-07–S6-11（前端）→ S6-12 验收 → S6-13 deploy

---

## S6 — 任务清单

### S6.1 后端（mu-plugin 1.7.0）

| ID | 任务 | 文件 | 估时 | 依赖 |
|----|------|------|------|------|
| S6-01 | 新增 `pdp` 模块（Layer D settings） | `includes/modules/pdp.php` **NEW** | 2h | — |
| S6-02 | `ybb_sm_product_purchase_slogan_payload()` | `includes/modules/products.php` | 2h | S6-01 |
| S6-03 | override defaults / normalize / save 扩展 4 字段 | `products.php`, `class-sanitize.php` | 2h | S6-02 |
| S6-04 | Admin 全站默认区块 + 表格 4 列 | `admin/tab-products.php` | 3h | S6-03 |
| S6-05 | `hasOverride` / audit-log diff | `product-index.php`, `audit-log.php` | 1h | S6-03 |
| S6-06 | 版本号 1.7.0 + REST-SPEC | `ybb-site-manager.php`, `REST-SPEC.md` | 1h | S6-02 |
| S6-07 | 上传 mu-plugin | `scripts/upload-ybb-site-manager.py` | 0.5h | S6-06 |

**后端小计：** ~11.5h

### S6.2 前端

| ID | 任务 | 文件 | 估时 | 依赖 |
|----|------|------|------|------|
| S6-08 | TS 类型 + `resolvePurchaseSlogan()` | `product-overrides-api.ts`, `purchase-slogan.ts` **NEW** | 1.5h | S6-02 |
| S6-09 | `ProductPurchasePanel` 接 `purchaseSlogan` | `ProductPurchasePanel.tsx` | 1.5h | S6-08 |
| S6-10 | `ProductDetail` 传入 resolved slogan | `ProductDetail.tsx` | 1h | S6-09 |
| S6-11 | Quick View 接 `useProductLive` | `ProductQuickViewModal.tsx` | 2h | S6-08 |
| S6-12 | 单元测试（resolve 优先级） | `purchase-slogan.test.ts` **NEW** | 1.5h | S6-08 |

**前端小计：** ~7.5h

### S6.3 验收与部署

| ID | 任务 | 文件 | 估时 | 依赖 |
|----|------|------|------|------|
| S6-13 | 验收脚本 | `scripts/product-purchase-slogan-acceptance.py` **NEW** | 2h | S6-07, S6-10 |
| S6-14 | build + deploy 静态前端 | `build-static.ps1 -SkipSync` | 1.5h | S6-10 |
| S6-15 | OPS runbook | `OPS-RUNBOOK-zh.md` | 0.5h | S6-13 |

**合计：** ~23h（≈ 3 人日）

---

## 交付物清单

```
deploy/wp-content/mu-plugins/ybb-site-manager/
├── includes/modules/pdp.php                  # NEW — Layer D
├── includes/modules/products.php             # EDIT — purchaseSlogan payload
├── includes/class-sanitize.php               # EDIT
├── includes/admin/tab-products.php           # EDIT — global + per-SKU columns
├── includes/admin/page.php                   # EDIT — pdp sanitize hook
├── includes/modules/product-index.php        # EDIT
├── includes/modules/audit-log.php            # EDIT
└── ybb-site-manager.php                      # EDIT → 1.7.0

omc-replica/ybb-site/
├── lib/site-manager/product-overrides-api.ts # EDIT
├── lib/site-manager/purchase-slogan.ts       # NEW
├── lib/site-manager/purchase-slogan.test.ts  # NEW
├── components/product/ProductPurchasePanel.tsx   # EDIT
├── components/product/ProductDetail.tsx          # EDIT
├── components/product/ProductQuickViewModal.tsx  # EDIT
├── scripts/product-purchase-slogan-acceptance.py # NEW
└── docs/ybb-site-manager/
    ├── PDP-PURCHASE-SLOGAN-DESIGN.md         # NEW
    ├── PDP-PURCHASE-SLOGAN-IMPLEMENTATION-PACK.md  # NEW
    ├── REST-SPEC.md                          # EDIT
    └── OPS-RUNBOOK-zh.md                     # EDIT
```

---

## 关键实现片段

### PHP — Layer D 模块（摘录）

```php
// includes/modules/pdp.php
function ybb_sm_pdp_defaults(): array
{
    return [
        'enabled' => true,
        'defaultSlogan' => ['en' => '', 'zh' => '', 'ja' => ''],
        'hideDefaultSloganGlobally' => false,
    ];
}

function ybb_sm_pdp_settings(): array
{
    $data = ybb_sm_get_module('pdp');
    return array_replace(ybb_sm_pdp_defaults(), is_array($data) ? $data : []);
}
```

### PHP — payload 合并

```php
function ybb_sm_product_purchase_slogan_payload(array $override): array
{
    $global = ybb_sm_pdp_settings();
    $text = [
        'en' => trim((string) ($override['sloganEn'] ?? '')),
        'zh' => trim((string) ($override['sloganZh'] ?? '')),
        'ja' => trim((string) ($override['sloganJa'] ?? '')),
    ];
    foreach (['en', 'zh', 'ja'] as $lang) {
        if ($text[$lang] === '') {
            $text[$lang] = trim((string) ($global['defaultSlogan'][$lang] ?? ''));
        }
    }

    if (!empty($override['hideSlogan'])) {
        return ['visible' => false, 'text' => $text];
    }

    $hasCustom = false;
    foreach ($text as $part) {
        if ($part !== '') {
            $hasCustom = true;
            break;
        }
    }

    if (!$hasCustom && !empty($global['hideDefaultSloganGlobally'])) {
        return ['visible' => false, 'text' => $text];
    }

    return ['visible' => true, 'text' => $text];
}
```

在 `ybb_sm_product_live_payload()` return 数组增加：

```php
'purchaseSlogan' => ybb_sm_product_purchase_slogan_payload($override),
```

### PHP — override 字段扩展

```php
// ybb_sm_product_override_defaults()
'sloganEn' => '',
'sloganZh' => '',
'sloganJa' => '',
'hideSlogan' => false,
```

### 前端 — resolve helper

```ts
export function resolvePurchaseSlogan(
  payload: PurchaseSloganPayload | undefined,
  locale: Locale,
  i18nFallback: string
): { visible: boolean; text: string } {
  if (payload?.visible === false) {
    return { visible: false, text: "" };
  }
  const key = locale === "zh" ? "zh" : locale === "ja" ? "ja" : "en";
  const remote = payload?.text?.[key]?.trim() ?? "";
  const text = remote || i18nFallback;
  if (!text.trim()) return { visible: false, text: "" };
  return { visible: true, text };
}
```

### 前端 — ProductPurchasePanel

```tsx
{purchaseSlogan?.visible !== false && (purchaseSlogan?.text ?? defaultDescription) && (
  <p className="text-sm text-foreground/60 leading-relaxed">
    {purchaseSlogan?.text ?? defaultDescription}
  </p>
)}
```

---

## 部署顺序（硬性）

| 步骤 | 命令 / 动作 | 说明 |
|------|-------------|------|
| 1 | 本地改 mu-plugin | S6-01–S6-06 |
| 2 | `py scripts/upload-ybb-site-manager.py` | **仅 mu-plugin**，无需 build |
| 3 | curl 验收 REST | 见下方 |
| 4 | 前端 S6-08–S6-11 + `npm run build` | 一次静态 deploy |
| 5 | `deploy-siteground-browser.ps1 -SkipBuild` | 全量 zip |
| 6 | `py scripts/verify-remote-deploy.py` | buildId + chunks |
| 7 | `py scripts/product-purchase-slogan-acceptance.py` | 业务验收 |

**之后运营只改 slogan：** 站点管理保存 → 硬刷新 PDP，**无需**步骤 4–6。

---

## REST 验收命令

```powershell
# 试点 SKU — 应有 purchaseSlogan
curl.exe -sS "https://carp-ybb.com/index.php?rest_route=/ybb/v1/site-manager/product-overrides/tz-xp-053"

# 设置全站默认后 — text.en 应变化
# 设置 hideSlogan 后 — visible: false
```

---

## 验收脚本场景（S6-13）

| Case | 后台操作 | 断言 |
|------|----------|------|
| A | 无配置 | REST `visible:true`；页面含 i18n 英文句 |
| B | 全站 defaultSlogan.en = `TEST-GLOBAL` | REST + PDP 含 `TEST-GLOBAL` |
| C | SKU sloganEn = `TEST-SKU` | 仅该 handle 含 `TEST-SKU` |
| D | SKU hideSlogan = true | REST `visible:false`；PDP 无 slogan `<p>` |
| E | PCT | Description Tab 仍独立存在 |

脚本路径：`scripts/product-purchase-slogan-acceptance.py`（模板参照 `product-content-tabs-acceptance.py`）

---

## 与 PCT 文档交叉引用

| 文档 | 变更 |
|------|------|
| `PDP-CONTENT-TABS-DESIGN.md` §1.3 | 将「未来全局 PDP 文案模块」改为 **见 PPS / POL-6** |
| `PDP-CONTENT-TABS-IMPLEMENTATION-PACK.md` Out 范围 | 链接 PPS 实施包 |
| `PRODUCT-OPS-DESIGN.md` 字段矩阵 | 增补 `purchaseSlogan` 行 |

---

## Checklist（上线前）

- [ ] mu-plugin 版本 **1.7.0**
- [ ] `GET product-overrides/tz-xp-053` 含 `purchaseSlogan`
- [ ] 产品 Tab 全站默认 + 4 列可保存
- [ ] audit-log 记录 slogan 变更
- [ ] `npm run build` PASS
- [ ] `verify-remote-deploy.py` PASS
- [ ] 试点 SKU 三场景（默认 / 覆盖 / 隐藏）PASS
- [ ] Quick View 与 PDP slogan 一致
- [ ] checkout 加购 smoke test 1 SKU

---

## 运维速查

| 运营诉求 | 操作 | 需 deploy？ |
|----------|------|-------------|
| 改全站默认 slogan | 站点管理 → 产品 Tab 顶部 | 否 |
| 改单个 SKU slogan | 产品 Tab 对应行 | 否 |
| 隐藏某 SKU slogan | 勾选「隐藏 slogan」 | 否 |
| 全站不显示 slogan | 顶部「全局隐藏」 | 否 |
| 改 i18n 代码兜底句 | 改 `dictionaries/*.json` + build | **是** |
