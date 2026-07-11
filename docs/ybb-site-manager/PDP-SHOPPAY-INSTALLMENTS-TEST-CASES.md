# PDP 分期提示条（Shop Pay Installments）— 测试用例（POL-7 / SPI）

> **配套设计：** `PDP-SHOPPAY-INSTALLMENTS-DESIGN.md`  
> **配套实施包：** `PDP-SHOPPAY-INSTALLMENTS-IMPLEMENTATION-PACK.md`  
> **自动化脚本（待实现）：** `scripts/product-shop-pay-installments-acceptance.py`  
> **试点 SKU：** `tz-qz-013`（父 SKU TZ-QZ-013，默认变体 56g @ $0.49 → amount≈$0.16）  
> **对照 SKU：** `tz-el-074`（hide 场景，任选已发布 variable product）

---

## 1. 测试范围

| 层级 | 覆盖 |
|------|------|
| mu-plugin REST | `product-live` / `product-overrides` 的 `shopPayInstallments` |
| Admin 保存 | Layer D 全站 + Layer C hide |
| 前端 PDP | 渲染 / 隐藏 / 变体 amount / 三语 |
| 前端 Quick View | 与 PDP 一致 |
| 回归 | PPS slogan · PCT Tab · 加购 · checkout |
| 非功能 | cache-bust · sessionStorage stale · sanitize |

---

## 2. 测试环境与前置

### 2.1 环境

- 生产：`https://carp-ybb.com`
- 本地 dev：`http://localhost:3000`（可选）
- WP Admin → **YBB 站点管理 → 产品**

### 2.2 前置条件

- [ ] mu-plugin **≥ 1.9.0** 已上传
- [ ] 静态前端含 SPI 组件改造（buildId 与线上一致）
- [ ] `tz-qz-013` 已 publish，live 价可用
- [ ] 浏览器可硬刷新（Ctrl+F5）或 Playwright headless

### 2.3 测试数据

| 键 | 值 |
|----|-----|
| `HANDLE_A` | `tz-qz-013` |
| `HANDLE_B` | `tz-el-074` |
| `PRICE_A_DEFAULT` | 0.49（56g 变体，以 live 为准） |
| `COUNT_DEFAULT` | 3 |
| `AMOUNT_A_EXPECTED` | `$0.16`（0.49/3 四舍五入到分） |
| `TEMPLATE_EN_TEST` | `TEST-SPI: {count} x {amount} total {total}` |
| `TEMPLATE_ZH_TEST` | `测试分期：{count}期，每期{amount}` |

---

## 3. REST API 测试用例

### TC-REST-01 — 默认 payload 结构

| 项 | 内容 |
|----|------|
| **步骤** | `GET /wp-json/ybb/v1/site-manager/product-live/tz-qz-013?_={ts}` |
| **期望** | HTTP 200；JSON 含 `shopPayInstallments` 对象 |
| **断言** | 字段存在：`visible`, `installmentCount`, `template.en`, `template.zh`, `template.ja` |
| **断言** | `installmentCount === 3`（默认） |
| **断言** | `visible === true`（全站 enabled 且 SKU 未 hide） |

```powershell
$t=[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
curl.exe -sS "https://carp-ybb.com/wp-json/ybb/v1/site-manager/product-live/tz-qz-013?_=$t"
```

---

### TC-REST-02 — resolved 预填 amount

| 项 | 内容 |
|----|------|
| **前置** | 默认模板启用；HANDLE_A 价 $0.49 |
| **步骤** | 同 TC-REST-01 |
| **断言** | `resolved.en` 含 `$0.16`（或 Woo 格式化等价） |
| **断言** | `resolved.en` 含 `3`（期数） |

---

### TC-REST-03 — 全站关闭

| 项 | 内容 |
|----|------|
| **步骤** | Admin 取消「启用分期提示条」→ 保存 |
| **步骤** | curl product-live HANDLE_A |
| **断言** | `shopPayInstallments.visible === false` |
| **断言** | `template` 仍可返回（便于再次开启） |

---

### TC-REST-04 — SKU 级隐藏

| 项 | 内容 |
|----|------|
| **前置** | 全站 enabled=true |
| **步骤** | HANDLE_B 勾选「隐藏分期条」→ 保存 |
| **步骤** | curl product-live HANDLE_A 与 HANDLE_B |
| **断言** | A：`visible === true` |
| **断言** | B：`visible === false` |

---

### TC-REST-05 — 模板更新即时生效

| 项 | 内容 |
|----|------|
| **步骤** | Admin 设 `template.en = TEMPLATE_EN_TEST` → 保存 |
| **步骤** | curl（带 cache-bust） |
| **断言** | `template.en === TEMPLATE_EN_TEST` |
| **断言** | `resolved.en` 含 `TEST-SPI:` 且含 `$0.16` |

---

### TC-REST-06 — 期数变更

| 项 | 内容 |
|----|------|
| **步骤** | Admin 设 `installmentCount = 4` → 保存 |
| **步骤** | curl HANDLE_A |
| **断言** | `installmentCount === 4` |
| **断言** | `resolved.en` 含 `$0.12`（0.49/4≈0.1225→$0.12） |

---

### TC-REST-07 — 最低展示价

| 项 | 内容 |
|----|------|
| **步骤** | Admin 设 `minPriceUsd = 1.00` → 保存 |
| **步骤** | curl HANDLE_A（价 $0.49） |
| **断言** | `visible === false` |
| **步骤** | 恢复 `minPriceUsd = 0` |

---

### TC-REST-08 — sanitize XSS

| 项 | 内容 |
|----|------|
| **步骤** | Admin 模板填入 `<script>alert(1)</script>Pay {amount}` → 保存 |
| **步骤** | curl |
| **断言** | `template.en` **不含** `<script>` |
| **断言** | 纯文本保留 `Pay {amount}` |

---

### TC-REST-09 — 无 query cache-bust

| 项 | 内容 |
|----|------|
| **说明** | SiteGround 可能缓存无 `_=` 的 JSON |
| **步骤** | 改模板后立即 curl **无** `_=` 的 URL |
| **期望** | 可能 stale（已知坑） |
| **步骤** | curl **带** `_=` |
| **断言** | 必为新值 |
| **结论** | 验收与前端 fetch **必须** cache-bust |

---

## 4. Admin 后台测试用例

### TC-ADMIN-01 — 全站设置保存回显

| 步骤 | 操作 | 期望 |
|------|------|------|
| 1 | 打开 YBB 站点管理 → 产品 Tab | 见「分期提示条」区块 |
| 2 | 修改英文模板 → 保存 | 成功提示 |
| 3 | 刷新 Admin 页 | 文本域回显新值 |

---

### TC-ADMIN-02 — 期数边界

| 输入 | 期望 |
|------|------|
| `1` | 保存后 clamp 为 `2` 或前端校验拒绝 |
| `99` | clamp 为 `12` |
| 空 | 默认 `3` |

---

### TC-ADMIN-03 — 每 SKU hide 列

| 步骤 | 期望 |
|------|------|
| 勾选 HANDLE_B「隐藏分期条」→ 保存 | audit-log 有记录 |
| 取消勾选 → 保存 | REST visible 恢复 true |

---

### TC-ADMIN-04 — audit-log

| 步骤 | 期望 |
|------|------|
| 改 enabled / count / template / hide | 审计日志含 `shopPayInstallments` 或字段名 |

---

## 5. 前台 PDP 功能测试用例

### TC-PDP-01 — 默认展示

| 项 | 内容 |
|----|------|
| **URL** | `/products/tz-qz-013.html` |
| **步骤** | 硬刷新；等待 live 加载完成 |
| **断言** | DOM 存在 `.shop-pay-installments` |
| **断言** | 文案含 `Shop Pay` 或当前模板关键词 |
| **断言** | 文案含 `$0.16`（默认变体） |

---

### TC-PDP-02 — 全站关闭后不渲染

| 项 | 内容 |
|----|------|
| **前置** | TC-REST-03 全站 enabled=false |
| **步骤** | 硬刷新 PDP HANDLE_A |
| **断言** | DOM **不存在** `.shop-pay-installments` |
| **断言** | 不影响价格 / 加购按钮 |

---

### TC-PDP-03 — SKU 隐藏

| 项 | 内容 |
|----|------|
| **前置** | TC-REST-04 |
| **步骤** | 打开 HANDLE_B PDP |
| **断言** | 无 `.shop-pay-installments` |
| **步骤** | 打开 HANDLE_A PDP |
| **断言** | 仍有分期条 |

---

### TC-PDP-04 — 变体切换 amount 更新

| 项 | 内容 |
|----|------|
| **URL** | `/products/tz-qz-013.html` |
| **步骤** | 选 56g（$0.49） | 文案含 `$0.16` |
| **步骤** | 选 113g（$0.89） | 文案含 `$0.30`（0.89/3≈0.2967） |
| **断言** | 切换过程中无 console error |

---

### TC-PDP-05 — 三语切换

| 项 | 内容 |
|----|------|
| **前置** | Admin 填 `template.zh = TEMPLATE_ZH_TEST` |
| **步骤** | 前台切中文（localStorage `ybb-locale=zh` 或语言切换器） |
| **断言** | 分期条含 `测试分期` |
| **步骤** | 切英文 |
| **断言** | 恢复英文模板 |

---

### TC-PDP-06 — 模板运营修改无需 deploy

| 项 | 内容 |
|----|------|
| **步骤** | Admin 改 `template.en` 为 `TEST-SPI: ...` |
| **步骤** | **不** build / deploy；仅硬刷新 PDP |
| **断言** | 5s 内看到 `TEST-SPI:` |

---

### TC-PDP-07 — 与 purchaseSlogan 共存

| 项 | 内容 |
|----|------|
| **前置** | HANDLE_A 有 purchaseSlogan 文案 |
| **步骤** | 打开 PDP |
| **断言** | 价格下方有分期条 |
| **断言** | 加购下方仍有 slogan 段 |
| **断言** | 两段文案内容不同 |

---

### TC-PDP-08 — 与 Description Tab 独立

| 项 | 内容 |
|----|------|
| **步骤** | 打开 PDP → 点击 Description Tab |
| **断言** | Tab 内容为商品长描述 |
| **断言** | Tab 内 **不含** Shop Pay 分期句 |

---

## 6. Quick View 测试用例

### TC-QV-01 — 与 PDP 一致

| 步骤 | 期望 |
|------|------|
| 类目页打开 HANDLE_A Quick View | 有分期条，amount 同 PDP |
| HANDLE_B（hide）Quick View | 无分期条 |

---

## 7. 回归测试用例

### TC-REG-01 — 加购

| 步骤 | 期望 |
|------|------|
| HANDLE_A 选变体 → Add to cart | HTTP 200 / 购物车数量 +1 |

---

### TC-REG-02 — checkout 跳转

| 步骤 | 期望 |
|------|------|
| 购物车 → checkout | 进入 Woo checkout 页 |

---

### TC-REG-03 — live 价

| 步骤 | 期望 |
|------|------|
| Woo 改变体价（不改分期设置） | PDP 价与分期 amount 同步更新 |

---

### TC-REG-04 — PPS / PCT 未破坏

| 步骤 | 期望 |
|------|------|
| 抽查 HANDLE_A | purchaseSlogan + Description Tab 正常 |

---

## 8. 单元测试（前端）

文件：`lib/site-manager/shop-pay-installments.test.ts`

| ID | 用例 | 输入 | 期望 |
|----|------|------|------|
| UT-01 | interpolate `{amount}` | template + vars | 替换正确 |
| UT-02 | interpolate 多次 `{count}` | `{count} x {count}` | 两处均替换 |
| UT-03 | visible=false | payload.visible=false | resolve 返回 null |
| UT-04 | price=0 | price=0 | 不渲染 |
| UT-05 | 空模板 fallback i18n | template.en="" | 用 i18n 字典 |
| UT-06 | locale=zh | template.zh 有值 | 中文模板 |
| UT-07 | count clamp | installmentCount=99 | 使用 12 |
| UT-08 | hide 不影响 template 解析 | visible false | text 仍可算但不渲染 |

---

## 9. 自动化验收脚本映射

脚本：`scripts/product-shop-pay-installments-acceptance.py`（S7-14 交付）

| 脚本 Case | 对应用例 | 自动化 |
|-----------|----------|--------|
| A | TC-REST-01 + TC-PDP-01 | REST + Playwright DOM |
| B | TC-REST-05 + TC-PDP-06 | REST template + 页面文本 |
| C | TC-REST-04 + TC-PDP-03 | 两 handle 对比 |
| D | TC-REST-03 + TC-PDP-02 | visible false + 无 DOM |
| E | TC-PDP-04 | 变体切换（可选，需 UI 交互） |
| F | TC-REG-01 | 加购 smoke（可选） |

**脚本骨架：**

```python
HANDLE = "tz-qz-013"
HANDLE_HIDDEN = "tz-el-074"  # 需预先 hide

# 1. fetch product-live → assert shopPayInstallments.visible
# 2. goto /products/{HANDLE}.html → assert .shop-pay-installments visible
# 3. assert text contains expected amount substring
# 4. optional: compare HANDLE_HIDDEN has no .shop-pay-installments
```

---

## 10. 兼容性 / 降级

### TC-COMPAT-01 — 旧 mu-plugin（无 shopPayInstallments）

| 场景 | 期望 |
|------|------|
| 前端已上新、mu-plugin 未上 | 回退 i18n 硬编码模板；行为与现网一致 |
| mu-plugin 已上、前端未 deploy | REST 有字段但 DOM 仍硬编码（短暂窗口） |

### TC-COMPAT-02 — 旧 sessionStorage cache

| 步骤 | 期望 |
|------|------|
| 改模板后不硬刷新（仅 SPA 导航） | 5min 内可能 stale；硬刷新必更新 |
| syncedAt / template 变化 | 触发 cache 失效 |

---

## 11. 性能

### TC-PERF-01 — 无额外 REST

| 断言 | SPI 数据在同一 `product-live` 响应内，不增加 fetch 次数 |

### TC-PERF-02 — 渲染开销

| 断言 | interpolate 为 O(n) 字符串 replace；变体切换 < 16ms |

---

## 12. 安全

| ID | 用例 | 期望 |
|----|------|------|
| SEC-01 | 模板 XSS | REST 无 script 标签 |
| SEC-02 | POST hide 字段 | 需 `manage_options` |
| SEC-03 | 公开 REST 只读 | 未授权 POST 403 |

---

## 13. 测试执行记录模板

| 日期 | 版本 | buildId | 执行人 | REST | PDP | QV | 回归 | 结果 |
|------|------|---------|--------|------|-----|-----|------|------|
| YYYY-MM-DD | mu 1.9.0 | | | /9 | /8 | /1 | /4 | PASS/FAIL |

---

## 14. 缺陷分级

| 级别 | 定义 | 示例 |
|------|------|------|
| P0 | 分期条误导支付 / checkout  broken | 展示 Shop Pay 但文案承诺不存在的分期 |
| P1 | 全站无法关闭 / amount 计算错误 | 0.49/3 显示 $0.49 |
| P2 | 三语 fallback 错误 / Quick View 不一致 | 中文仍显示英文 |
| P3 | UI 间距 / audit-log 缺失 | 纯样式 |

---

## 15. 上线签字

- [ ] 开发：REST + 前端实现完成  
- [ ] QA：`product-shop-pay-installments-acceptance.py` PASS  
- [ ] 运营：Admin 文案说明已读  
- [ ] 法务：Shop Pay 展示与真实支付能力已确认  
