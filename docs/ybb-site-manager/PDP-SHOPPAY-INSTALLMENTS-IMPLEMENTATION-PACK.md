# PDP 分期提示条（Shop Pay Installments）— PRD & 实施包（POL-7 / SPI）

> **配套技术设计：** `PDP-SHOPPAY-INSTALLMENTS-DESIGN.md`  
> **配套测试用例：** `PDP-SHOPPAY-INSTALLMENTS-TEST-CASES.md`  
> **前置：** PPS（POL-6）· PCT（POL-5）已上线；mu-plugin **≥ 1.8.14**  
> **目标 mu-plugin 版本：** **1.9.0**  
> **建议工期：** 1 Sprint（1 人 × 1 人日）  
> **试点 SKU：** `tz-qz-013` · 对照 `tz-el-074`

---

## PRD 摘要

### 背景

PDP 购买区价格下方的 **Shop Pay 分期提示条**（`ShopPayInstallment.tsx`）文案与期数写死在 Next 代码中，全站所有已发布 SKU 强制显示同一句英文模板；金额虽随 live 价自动计算，但运营无法：

- 关闭全站或单 SKU 展示  
- 修改三语文案或期数  
- 设置最低展示价阈值  
- 保存后在后台即时预览（必须改代码 + deploy）

本 Sprint 将 SPI 纳入 **Layer D 全站 PDP 设置 + Layer C SKU 隐藏**，经 `product-live` REST 驱动，与 PPS slogan / PCT 描述同一运营模型。

### 用户故事

| 角色 | 故事 | 验收 |
|------|------|------|
| **运营** | 在站点管理关闭全站分期条 | 任意 PDP 硬刷新后无紫色条 |
| **运营** | 修改英文模板为中性支付句 | REST `template.en` 变化；PDP 显示新句 |
| **运营** | 设置期数为 4 | `{count}=4`；amount=price/4 |
| **运营** | 对单个 SKU 勾选「隐藏分期条」 | 仅该 handle 不显示 |
| **运营** | 改模板后 **不** 重新部署静态包 | 保存 → 硬刷新即生效 |
| **买家** | 切换变体 | 分期金额随价格更新 |
| **买家** | 切换中/日文 | 显示对应语言模板 |
| **开发** | 不增加 REST 往返 | 并入现有 `product-live` |
| **法务** | 未接入 Shop Pay 时可全站关闭 | `enabled=false` 一键隐藏 |

### 范围（In）

- Layer D：`shopPayInstallments`（enabled、installmentCount、minPriceUsd、template 三语）  
- Layer C：`hideShopPayInstallments`  
- mu-plugin REST / sanitize / Admin UI  
- 前端 `ShopPayInstallment` / `ProductPurchasePanel` / `ProductDetail` / `QuickView`  
- i18n 兜底键 `product.shopPayInstallmentTemplate`  
- 验收脚本 `product-shop-pay-installments-acceptance.py`  
- REST-SPEC / OPS runbook 增补  

### 非目标（Out）

- 接入真实 Shop Pay / Klarna API  
- Woo 单产品编辑页增加字段  
- 列表卡片 / Featured 区块显示分期条  
- 富文本模板 / 自定义 HTML  
- 多币种分期规则（MVP 跟 Woo USD）  

### 成功指标

| 指标 | 目标 |
|------|------|
| 后台改模板 → PDP 更新 | 硬刷新 ≤ 5s 可见 |
| 全站关闭 | 0 SKU 显示紫色条 |
| SKU 隐藏 | 仅该 handle DOM 无 `.shop-pay-installments` |
| 变体切换 amount | 与 price/count 一致 |
| PPS / PCT / checkout 回归 | 0 回归 |
| 试点验收脚本 | 全部 PASS |

---

## Sprint 总览

| Sprint | 代号 | 目标 | 可独立上线 |
|--------|------|------|------------|
| **S7** | **SPI / POL-7** | 分期提示条可配置可隐藏 | **是**（mu-plugin 先上，前端随后） |

**推荐顺序：** S7-01 → S7-06（PHP）→ 上传 mu-plugin → S7-07–S7-12（前端）→ S7-13 验收 → S7-14 deploy

---

## S7 — 任务清单

### S7.1 后端（mu-plugin 1.9.0）

| ID | 任务 | 文件 | 估时 | 依赖 |
|----|------|------|------|------|
| S7-01 | 扩展 `ybb_sm_pdp_defaults()` + settings | `includes/modules/pdp.php` | 1.5h | — |
| S7-02 | `ybb_sm_product_shop_pay_installments_payload()` | `includes/modules/pdp.php` | 2h | S7-01 |
| S7-03 | 挂入 `ybb_sm_product_live_payload()` | `includes/modules/products.php` | 0.5h | S7-02 |
| S7-04 | sanitize / save Layer D + override `hideShopPayInstallments` | `class-sanitize.php`, `products.php` | 2h | S7-02 |
| S7-05 | Admin 全站区块 + 表格列 | `admin/tab-products.php` | 2.5h | S7-04 |
| S7-06 | audit-log + 版本 1.9.0 + REST-SPEC | `audit-log.php`, `ybb-site-manager.php`, `REST-SPEC.md` | 1h | S7-03 |
| S7-07 | 上传 mu-plugin | `scripts/upload-ybb-site-manager.py` | 0.5h | S7-06 |

**后端小计：** ~10h

### S7.2 前端

| ID | 任务 | 文件 | 估时 | 依赖 |
|----|------|------|------|------|
| S7-08 | TS 类型 + `resolveShopPayInstallmentText()` | `product-overrides-api.ts`, `shop-pay-installments.ts` **NEW** | 2h | S7-02 |
| S7-09 | 改造 `ShopPayInstallment.tsx` | `ShopPayInstallment.tsx` | 1h | S7-08 |
| S7-10 | `ProductPurchasePanel` 接 live payload | `ProductPurchasePanel.tsx` | 1h | S7-09 |
| S7-11 | `ProductDetail` + `QuickView` 传 live | `ProductDetail.tsx`, `ProductQuickViewModal.tsx` | 1.5h | S7-10 |
| S7-12 | i18n 兜底 + 单元测试 | `dictionaries/*.json`, `shop-pay-installments.test.ts` **NEW** | 1.5h | S7-08 |
| S7-13 | 扩展 live cache stale 检测 | `hooks/useProductLive.ts` | 0.5h | S7-08 |

**前端小计：** ~7.5h

### S7.3 验收与部署

| ID | 任务 | 文件 | 估时 | 依赖 |
|----|------|------|------|------|
| S7-14 | 验收脚本 | `scripts/product-shop-pay-installments-acceptance.py` **NEW** | 2h | S7-07, S7-11 |
| S7-15 | build + sync 部署机 + SiteGround | `build-static.ps1 -SkipSync` | 1.5h | S7-11 |
| S7-16 | OPS runbook | `OPS-RUNBOOK-zh.md` | 0.5h | S7-14 |

**合计：** ~21.5h（≈ 1 人日）

---

## 交付物清单

```
deploy/wp-content/mu-plugins/ybb-site-manager/
├── includes/modules/pdp.php                  # EDIT — shopPayInstallments Layer D + payload
├── includes/modules/products.php             # EDIT — live payload hook
├── includes/class-sanitize.php               # EDIT
├── includes/admin/tab-products.php           # EDIT — global block + hide column
├── includes/modules/product-index.php        # EDIT — hasOverride
├── includes/modules/audit-log.php            # EDIT
└── ybb-site-manager.php                      # EDIT → 1.9.0

omc-replica/ybb-site/
├── lib/site-manager/product-overrides-api.ts # EDIT — types
├── lib/site-manager/shop-pay-installments.ts # NEW
├── lib/site-manager/shop-pay-installments.test.ts # NEW
├── lib/i18n/dictionaries/en.json           # EDIT — shopPayInstallmentTemplate
├── lib/i18n/dictionaries/zh.json           # EDIT
├── lib/i18n/dictionaries/ja.json             # EDIT
├── components/product/ShopPayInstallment.tsx # EDIT
├── components/product/ProductPurchasePanel.tsx   # EDIT
├── components/product/ProductDetail.tsx          # EDIT
├── components/product/ProductQuickViewModal.tsx  # EDIT
├── hooks/useProductLive.ts                 # EDIT — cache stale
├── scripts/product-shop-pay-installments-acceptance.py # NEW
└── docs/ybb-site-manager/
    ├── PDP-SHOPPAY-INSTALLMENTS-DESIGN.md
    ├── PDP-SHOPPAY-INSTALLMENTS-IMPLEMENTATION-PACK.md
    ├── PDP-SHOPPAY-INSTALLMENTS-TEST-CASES.md
    ├── REST-SPEC.md                          # EDIT
    └── OPS-RUNBOOK-zh.md                     # EDIT
```

---

## 关键实现片段

### PHP — Layer D defaults（`pdp.php`）

```php
function ybb_sm_pdp_defaults(): array
{
    return [
        // ... existing defaultSlogan, tabLabels ...
        'shopPayInstallments' => [
            'enabled' => true,
            'installmentCount' => 3,
            'minPriceUsd' => 0.0,
            'template' => [
                'en' => 'Pay in {count} interest-free instalments of {amount} with Shop Pay',
                'zh' => '',
                'ja' => '',
            ],
        ],
    ];
}
```

### PHP — payload

```php
function ybb_sm_interpolate_installment_template(string $template, float $price, int $count): string
{
    $count = max(2, min(12, $count));
    $per = $count > 0 ? $price / $count : $price;
    $amount = wc_price($per, ['html' => false]);
    $total = wc_price($price, ['html' => false]);
    return str_replace(
        ['{amount}', '{count}', '{total}'],
        [$amount, (string) $count, $total],
        $template
    );
}

function ybb_sm_product_shop_pay_installments_payload(array $override, float $price): array
{
    $global = ybb_sm_pdp_settings();
    $cfg = $global['shopPayInstallments'] ?? [];
    $enabled = !empty($cfg['enabled']);
    $count = max(2, min(12, (int) ($cfg['installmentCount'] ?? 3)));
    $min = (float) ($cfg['minPriceUsd'] ?? 0);

    $template = [
        'en' => ybb_sm_sanitize_slogan_text((string) ($cfg['template']['en'] ?? '')),
        'zh' => ybb_sm_sanitize_slogan_text((string) ($cfg['template']['zh'] ?? '')),
        'ja' => ybb_sm_sanitize_slogan_text((string) ($cfg['template']['ja'] ?? '')),
    ];

    $visible = $enabled
        && empty($override['hideShopPayInstallments'])
        && ($min <= 0 || $price >= $min)
        && ($template['en'] !== '' || $template['zh'] !== '' || $template['ja'] !== '');

    $resolved = [];
    foreach (['en', 'zh', 'ja'] as $lang) {
        $resolved[$lang] = $template[$lang] !== ''
            ? ybb_sm_interpolate_installment_template($template[$lang], $price, $count)
            : '';
    }

    return [
        'visible' => $visible,
        'installmentCount' => $count,
        'minPriceUsd' => $min,
        'template' => $template,
        'resolved' => $resolved,
    ];
}
```

在 `ybb_sm_product_live_payload()`：

```php
'shopPayInstallments' => ybb_sm_product_shop_pay_installments_payload(
    $override,
    (float) $prices['price']
),
```

### PHP — override 字段

```php
'hideShopPayInstallments' => false,
```

### 前端 — resolve helper

```ts
export function interpolateInstallmentTemplate(
  template: string,
  vars: { amount: string; count: number; total: string }
): string {
  return template
    .replaceAll("{amount}", vars.amount)
    .replaceAll("{count}", String(vars.count))
    .replaceAll("{total}", vars.total);
}

export function resolveShopPayInstallmentText(
  payload: ShopPayInstallmentsPayload | undefined,
  locale: Locale,
  price: number,
  i18nTemplate: string
): { visible: boolean; text: string } | null {
  if (!payload || payload.visible === false || price <= 0) return null;
  const key = locale === "zh" ? "zh" : locale === "ja" ? "ja" : "en";
  const count = Math.max(2, Math.min(12, payload.installmentCount || 3));
  const template = (payload.template?.[key] || "").trim() || i18nTemplate.trim();
  if (!template) return null;
  const text = interpolateInstallmentTemplate(template, {
    amount: formatInstallmentPrice(price, count),
    count,
    total: formatPrice(price),
  });
  return { visible: true, text };
}
```

### 前端 — ProductPurchasePanel

```tsx
{installment?.visible && (
  <ShopPayInstallment text={installment.text} />
)}
```

---

## 部署顺序（硬性）

| 步骤 | 命令 / 动作 | 说明 |
|------|-------------|------|
| 1 | 本地改 mu-plugin S7-01–S7-06 | |
| 2 | `py scripts/upload-ybb-site-manager.py` | 仅 mu-plugin |
| 3 | curl 验收 REST | 见 TEST-CASES TC-REST-01 |
| 4 | 前端 S7-08–S7-13 + `npm run build` | |
| 5 | `python scripts/sync-to-deploy-machine.py` | 部署机 build |
| 6 | `deploy-siteground-browser.ps1 -SkipBuild` | SiteGround |
| 7 | `py scripts/verify-remote-deploy.py` | buildId |
| 8 | `py scripts/product-shop-pay-installments-acceptance.py` | 业务验收 |

**之后运营只改分期模板：** 站点管理保存 → 硬刷新 PDP，**无需**步骤 4–7。

---

## REST 验收命令

```powershell
$t=[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()

# 默认应 visible + template
curl.exe -sS "https://carp-ybb.com/wp-json/ybb/v1/site-manager/product-live/tz-qz-013?_=$t"

# 全站 enabled=false 后 — visible:false
# SKU hideShopPayInstallments=true 后 — visible:false（仅该 handle）
```

---

## 与现有文档交叉引用

| 文档 | 变更 |
|------|------|
| `PDP-PURCHASE-SLOGAN-DESIGN.md` §2.1 | 增补 SPI 区块说明 |
| `PRODUCT-OPS-DESIGN.md` | 字段矩阵 + Layer D |
| `OPS-RUNBOOK-zh.md` | 「分期提示条」运营节 |
| `ACCEPTANCE-CHECKLIST.md` | 可选勾选 SPI |

---

## Checklist（上线前）

- [ ] mu-plugin 版本 **1.9.0**
- [ ] `product-live/tz-qz-013` 含 `shopPayInstallments`
- [ ] 产品 Tab 全站设置 + 「隐藏分期条」列可保存
- [ ] audit-log 记录 SPI 变更
- [ ] `npm run build` PASS（本地 + 部署机）
- [ ] `verify-remote-deploy.py` PASS
- [ ] `product-shop-pay-installments-acceptance.py` 全部 PASS
- [ ] Quick View 与 PDP 分期条一致
- [ ] 变体切换 amount 正确
- [ ] checkout 加购 smoke test 1 SKU
- [ ] 法务确认 Shop Pay 文案与支付能力一致

---

## 运维速查

| 运营诉求 | 操作 | 需 deploy？ |
|----------|------|-------------|
| 全站关闭分期条 | 产品 Tab → 取消「启用分期提示条」 | 否 |
| 改英文/中/日模板 | 产品 Tab 顶部模板文本域 | 否 |
| 改期数 | 产品 Tab → 分期期数 | 否 |
| 某 SKU 不显示 | 产品 Tab 行 → 勾选隐藏 | 否 |
| 低于 $X 不显示 | 产品 Tab → 最低展示价 | 否 |
| 改紫色 UI 样式 | 改 `ShopPayInstallment.tsx` + build | **是** |
| 改代码兜底模板 | 改 i18n 字典 + build | **是** |
