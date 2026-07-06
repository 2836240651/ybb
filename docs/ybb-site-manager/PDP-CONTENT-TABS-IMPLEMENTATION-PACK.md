# PDP 商品描述与附加信息 — PRD & 实施包（POL-5 / PCT）

> **配套技术设计：** `PDP-CONTENT-TABS-DESIGN.md`  
> **父实施包：** `PRODUCT-OPS-IMPLEMENTATION-PACK.md`（S1–S4 已完成或进行中）  
> **建议工期：** 1 Sprint（3–5 人日，1 人）  
> **mu-plugin 目标版本：** 1.6.0  
> **基准 UX：** carpzoom WooCommerce Product Tabs

---

## PRD 摘要

### 背景

YBB 独立站 PDP 缺少对标 carpzoom 的 **Description** / **Additional information** 内容区；购买区现有文案为全站 slogan，不能承担 per-SKU 商品说明。运营需要在 **WooCommerce + YBB 站点管理** 内维护内容，且改完后 **无需重新部署静态包**。

### 用户故事

| 角色 | 故事 | 验收 |
|------|------|------|
| **运营** | 在 Woo 产品编辑里填写英文长描述与属性，前台 PDP 出现对应 Tab | 保存 Woo 后刷新 PDP 可见 |
| **运营** | 在站点管理为某 SKU 填写中文描述或隐藏附加信息 | 保存后即时生效 |
| **买家** | 在商品图下方看到描述与参数表，便于决策 | 布局在 Pairs well with 之上 |
| **开发** | 不增加 REST 往返、不破坏加购/checkout | acceptance 全绿 |

### 范围（In）

- PDP 全站：`ProductContentTabs`（Description + Additional information）
- 扩展 `product-overrides/{handle}` REST `content` 字段
- 站点管理产品 Tab：描述覆盖 + 隐藏开关
- i18n Tab 标题（中/英/日）
- 验收脚本 `product-content-tabs-acceptance.py`

### 非目标（Out）

- `products.json` 同步 description
- 属性归档筛选页
- 替换购买区 `defaultDescription`
- 批量从 Excel 灌 Woo Description（可另开脚本任务，不在本 Sprint）

### 成功指标

| 指标 | 目标 |
|------|------|
| 改 Woo Description 后 PDP 更新 | ≤ 硬刷新即时 |
| 改站点管理覆盖后更新 | 同左，无 redeploy |
| 加购/checkout 回归 | 0 回归 |
| 抽样 SKU 与 Woo 后台一致 | 3/3 PASS |

---

## Sprint 总览

| Sprint | 代号 | 目标 | 可独立上线 |
|--------|------|------|------------|
| **S5** | **PCT / POL-5** | PDP Description + Additional info + 后台覆盖 | **是** |

**推荐实施顺序：** S5-01 → S5-02 → S5-03 → S5-04 → S5-05 → S5-06

---

## S5 — PCT：PDP 内容 Tab（mu-plugin 1.6.0 + 前端）

### S5.1 任务清单

| ID | 任务 | 文件 | 估时 | 依赖 |
|----|------|------|------|------|
| S5-01 | `ybb_sm_product_additional_rows()` | `includes/modules/products.php` | 3h | — |
| S5-02 | `content` 并入 `ybb_sm_product_live_payload()` | `includes/modules/products.php` | 2h | S5-01 |
| S5-03 | override get/save 扩展 4 字段 | `products.php`, `class-sanitize.php` | 3h | S5-02 |
| S5-04 | Admin 产品 Tab 表单列 | `admin/tab-products.php` | 4h | S5-03 |
| S5-05 | audit diff 新字段 | `modules/audit-log.php` | 1h | S5-03 |
| S5-06 | REST 文档 + 版本号 1.6.0 | `REST-SPEC.md`, `ybb-site-manager.php` | 1h | S5-02 |
| S5-07 | 上传 mu-plugin 验收 | `scripts/upload-ybb-site-manager.py` | 1h | S5-06 |
| S5-08 | TS 类型扩展 | `product-overrides-api.ts` | 1h | S5-02 |
| S5-09 | `ProductContentTabs` 组件 | `components/product/ProductContentTabs.tsx` | 6h | S5-08 |
| S5-10 | `ProductDetail` 接入 + i18n | `ProductDetail.tsx`, `dictionaries/*.json` | 2h | S5-09 |
| S5-11 | 样式与移动端手风琴 | `ProductContentTabs.tsx`, `globals.css`（如需） | 3h | S5-09 |
| S5-12 | 验收脚本 | `scripts/product-content-tabs-acceptance.py` | 3h | S5-07, S5-10 |
| S5-13 | build + deploy 静态前端 | `build-static.ps1 -SkipSync` | 2h | S5-10 |
| S5-14 | OPS runbook 增补 | `OPS-RUNBOOK-zh.md` | 1h | S5-12 |

**合计：** 约 33h（≈ 4–5 人日）

### S5.2 交付物清单

```
deploy/wp-content/mu-plugins/ybb-site-manager/
├── includes/modules/products.php           # EDIT (+ content payload)
├── includes/class-sanitize.php             # EDIT
├── includes/admin/tab-products.php         # EDIT
├── includes/modules/audit-log.php          # EDIT
└── ybb-site-manager.php                    # EDIT → 1.6.0

omc-replica/ybb-site/
├── components/product/ProductContentTabs.tsx   # NEW
├── components/product/ProductDetail.tsx        # EDIT
├── lib/site-manager/product-overrides-api.ts   # EDIT
├── lib/site-manager/product-content.ts         # NEW (optional helper)
├── lib/i18n/dictionaries/en.json               # EDIT
├── lib/i18n/dictionaries/zh.json               # EDIT
├── lib/i18n/dictionaries/ja.json               # EDIT
├── scripts/product-content-tabs-acceptance.py  # NEW
└── docs/ybb-site-manager/
    ├── PDP-CONTENT-TABS-DESIGN.md              # NEW
    ├── PDP-CONTENT-TABS-IMPLEMENTATION-PACK.md # NEW
    ├── REST-SPEC.md                            # EDIT
    └── OPS-RUNBOOK-zh.md                       # EDIT
```

### S5.3 关键实现片段

#### PHP — 附加信息行

```php
function ybb_sm_product_additional_rows(WC_Product $product): array
{
    $rows = [];
    $weight = $product->get_weight();
    if ($weight !== '' && (float) $weight > 0) {
        $rows[] = [
            'key' => 'weight',
            'label' => __('Weight', 'ybb-site-manager'),
            'value' => wc_format_weight($weight),
            'href' => null,
        ];
    }
    foreach ($product->get_attributes() as $attribute) {
        if (!$attribute->get_visible()) {
            continue;
        }
        // … resolve taxonomy terms → label + value + optional href …
    }
    return $rows;
}
```

#### PHP — live payload 追加

```php
// inside ybb_sm_product_live_payload()
'content' => [
    'description' => ybb_sm_product_description_payload($product, $override),
    'additionalInfo' => [
        'visible' => !$override['hideAdditionalInfo'] && $rows !== [],
        'rows' => $override['hideAdditionalInfo'] ? [] : $rows,
    ],
],
```

#### React — 空态与 locale

```tsx
export function ProductContentTabs({ content, ready, locale }: Props) {
  if (!ready) return <ProductContentTabsSkeleton />;
  if (!content) return null;
  const { description, additionalInfo } = content;
  if (!description.visible && !additionalInfo.visible) return null;
  const html = description.html[locale] || description.html.en;
  // … tabs …
}
```

### S5.4 验收命令

```powershell
Set-Location "D:\开发\fishAgent\总包\skill\reverse-skill\omc-replica\ybb-site"

# 1. 上传 mu-plugin
py scripts/upload-ybb-site-manager.py

# 2. REST 抽检（替换 handle）
py -c "
import urllib.request, json
url='https://carp-ybb.com/index.php?rest_route=/ybb/v1/site-manager/product-overrides/tz-zbsb-006-l'
print(json.loads(urllib.request.urlopen(url).read()).get('content',{}))
"

# 3. 前端 build + dev
npm run build
powershell -ExecutionPolicy Bypass -File scripts/restart-dev.ps1

# 4. 专项验收
py scripts/product-content-tabs-acceptance.py

# 5. 回归
py scripts/cart-add-item-acceptance.py
py scripts/product-ops-acceptance.py
```

### S5.5 验收勾选表

**后端**

- [ ] `GET .../product-overrides/{handle}` 含 `content.description` / `content.additionalInfo`
- [ ] Woo 改 Description → REST `html.en` 变化
- [ ] POST `descriptionZh` → REST `html.zh` 变化
- [ ] `hideDescription=true` → `description.visible=false`
- [ ] POST 含 `price` → 400（回归）
- [ ] 审计日志记录描述覆盖变更

**前台**

- [ ] localhost `/products/{handle}`：Tab 在 grid 下、Pairs well with 上
- [ ] 英文 Description HTML 正确渲染（列表/段落）
- [ ] Additional 表头/值与 Woo Attributes 一致
- [ ] 切换 zh locale → 显示 `descriptionZh`（若已填）
- [ ] 两栏皆空 → 无 Tab 区域
- [ ] 购买区仍显示 `defaultDescription` slogan
- [ ] Mobile：手风琴可展开/收起

**部署**

- [ ] 生产 deploy 静态 JS 一次后 PDP 出现 Tab
- [ ] 仅改 Woo 描述 **不** 触发 redeploy 即可见新文案

---

## 验收脚本规格（S5-12）

**`scripts/product-content-tabs-acceptance.py`**

| 步骤 | 动作 |
|------|------|
| 1 | 读 `secrets.local.json` 或 env 抽样 handles（默认 3 个：有描述、仅属性、皆空） |
| 2 | `GET product-overrides/{handle}` 断言 `content` schema |
| 3 | Playwright 打开 `/products/{handle}`，断言 `#product-content-tabs` 存在/不存在 |
| 4 | 有 content 时断言 Tab 文案、表行数 ≥ REST `rows.length` |
| 5 | 输出 `reports/product-content-tabs-acceptance.json` |

---

## 运营手册增补（S5-14 写入 OPS-RUNBOOK）

| 操作 | 入口 | 生效 |
|------|------|------|
| 填英文商品描述 | Woo → 产品 → **Description** | PDP 即时 |
| 填重量/属性 | Woo → **Shipping** + **Attributes** | PDP 即时 |
| 中文/日文描述覆盖 | YBB 站点管理 → 产品 | 即时 |
| 隐藏描述或附加信息 | 站点管理 → 对应 checkbox | 即时 |
| 改全站购买区 slogan | 开发改 i18n（本 Sprint 不动） | 需 deploy |

---

## 测试矩阵（S5）

| 场景 | 期望 | ID |
|------|------|-----|
| Woo 填 Description | Description Tab 出现 | T1 |
| Woo 仅 Attributes | 仅 Additional Tab | T2 |
| 皆空 | 无 Tab 区块 | T3 |
| descriptionZh 覆盖 | zh 页面显示中文 | T4 |
| hideAdditionalInfo | Additional 不显示 | T5 |
| 变体商品 | 父级描述展示（不按变体分描述） | T6 |
| frontHidden 商品 | 仍可直链看 Tab（或随 PDP 隐藏策略） | T7 |
| 加购 | add-item 200 | T8 |

---

## 依赖与前置

| 项 | 状态 |
|----|------|
| POL S2 `useProductLive` + `product-overrides/{handle}` | 必需 |
| ybb-site-manager ≥ 1.4.0 | 必需 |
| Woo 产品已 publish | 必需 |
| 抽样 SKU 在 Woo 有 Description（验收用） | 验收前准备 |

---

## 回滚策略

| 层级 | 操作 |
|------|------|
| mu-plugin 1.6.0 | 回退上一版 `ybb-site-manager/` |
| 前端 Tab 组件 | redeploy 上一版静态 `out/` |
| override 新字段 | Admin 清空 descriptionZh / 取消 hide；删键不影响价/库存 |
| REST `content` 缺失 | 前端 `content` 可选链 → 不渲染 Tab（安全降级） |

---

## 排期建议

| 天 | 内容 |
|----|------|
| D1 | S5-01 ~ S5-07（后端 + mu-plugin 上传 + REST 手测） |
| D2 | S5-08 ~ S5-11（前端组件 + ProductDetail） |
| D3 | S5-12 ~ S5-14（验收脚本 + runbook + 生产 deploy 前端） |

---

## 与主 PRD / POL 关系

| 文档 | 变更 |
|------|------|
| `PRD.md` | 增加 Phase 2.6 / POL-5 一行 |
| `PRODUCT-OPS-DESIGN.md` | §9 版本表增加 1.6.0 PCT |
| `PRODUCT-OPS-IMPLEMENTATION-PACK.md` | Sprint 表增加 S5 |
| `ACCEPTANCE-CHECKLIST.md` | 增加 PCT 勾选节（可选） |

---

## 下一步

1. 评审 `PDP-CONTENT-TABS-DESIGN.md` REST `content` 字段  
2. 指定 3 个验收 SKU（建议含 `TZ-ZBSB-006-L`）并在 Woo 预填 Description + Attributes  
3. 从 **S5-01** 开工
