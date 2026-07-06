# OMC Newsletter & Chat Audit

> Generated: 2026-06-24  
> Script: `scripts/audit-omc-newsletter-chat.mjs`  
> JSON: `scripts/omc-newsletter-chat-audit.json`  
> Screenshots: `audit-screenshots/newsletter-chat/`

---

## 1. Footer Newsletter（OMC SIGN UP）

### 实现方式

| 项 | OMC 实测 |
|----|----------|
| 平台 | Shopify **Concept** 主题（5.3.1）原生 footer section |
| 区块类名 | `footer__newsletter` / `footer__right`（右栏） |
| 标题 | **OMC SIGN UP**（`heading text-base-2xl font-medium lg:font-heading`） |
| 表单 | `form.newsletter-form.grid.gap-5` |
| 提交 | `POST /contact#newsletter-{sectionId}`（Shopify Customer 联系表单） |
| 字段名 | `contact[email]`，`autocomplete=email`，`required` |
| Placeholder | `Enter your email` |
| 输入框类 | `input is-floating input--fill`（**浮动标签**模式，非纯 placeholder） |
| 按钮 | `button.button--primary.self-button`，**40×40px 白底圆钮**，内嵌 `icon-arrow-right` SVG |
| 按钮位置 | `self-button`：绝对定位在 `field relative` 容器**右侧内部** |
| 说明文案 | 表单下方 `<p>`（gap-5 = 20px 间距） |
| 社交 | `footer__socials`，4 个 **24×24** SVG 图标（Facebook / Instagram / YouTube / TikTok） |

### 实测样式（1440px）

| 元素 | 值 |
|------|-----|
| 栏宽 | 430px |
| 输入框 | 430×**62px**；`border-radius: 6px`；`background: rgba(255,255,255,0.043)` |
| 输入 padding | `16px 26px 0 26px`（浮动标签留白） |
| 输入 transition | `border-color / background-color 0.5s cubic-bezier(0.3, 1, 0.3, 1)` |
| Focus | `outline: 3px white`；bg → `rgba(255,255,255,0.106)` |
| 提交钮 | 40×40px；`border-radius: 50%`；`background: #fff`；箭头 `#000` |
| Section 背景 | `--color-background: 31 31 31` → `rgb(31,31,31)` |
| Section padding | `--section-padding-top/bottom: 72px` |

### DOM 结构（简化）

```
.footer__right
  h2.heading → "OMC SIGN UP"
  form.newsletter-form.grid.gap-5
    div.field.relative
      input.input.is-floating.input--fill[name="contact[email]"]
      label → "Enter your email"
      button.button.self-button[type=submit] → arrow SVG
  p → 订阅说明
  div.footer__socials → 4× a.social_platform > svg.icon
```

### ybb 当前差距

| 维度 | OMC | ybb (`FooterNewsletter.tsx`) |
|------|-----|------------------------------|
| 输入高度 | 62px | 52px (`--footer-newsletter-input-height: 3.25rem`) |
| 外框圆角 | 输入本身 6px | 整栏 pill (`--rounded-button`) |
| 标签模式 | floating label (`is-floating`) | 仅 placeholder |
| 输入背景 | 半透明填色在 input 上 | 透明 input + 外层 wrapper 背景 |
| 后端 | Shopify `/contact` 订阅 | `preventDefault` 占位，未接 WC |
| 标题字号 | ~21px / 700 | clamp 1.5–2rem uppercase |

---

## 2. Chat 浮窗

### 实现方式（重要）

**OMC 未使用 Shopify Inbox，也未使用自研 Chat 面板。**

实测加载的聊天相关脚本：

```
https://cdn.chaty.app/pixel.js?id=gz1m166v&shop=one-more-cast-ali.myshopify.com
POST https://prod-api.chaty.app/api/pixel/widgets
```

| 项 | OMC |
|----|-----|
| 产品 | **[Chaty](https://chaty.app)** Shopify App（第三方） |
| 注入 | `pixel.js` 异步加载，配置走 Chaty API |
| DOM | 无 `#shopify-chat`、无自研 dialog；headless 下未见固定右下角 launcher（可能延迟/地区/交互触发） |
| 形态 | 通常为**多渠道入口**（WhatsApp / Email / 等圆形浮动钮），非 OMC 主题内嵌组件 |

另加载 `customer-first-focus.b-cdn.net/cffPCLoader_min.js` — 为 **Customer First Focus**（评价/社交证明），**不是聊天**。

### ybb 当前实现

`components/chat/ChatWidget.tsx` + `lib/chat-config.ts` 为 **自研 UI**，注释写「mirrors Shopify Inbox」，但：

- OMC 基准站实际是 **Chaty 插件**
- 截图中的 B2B 欢迎语（MOQ / OEM / sample kits）来自 ybb `chatConfig.greetingLines`，**非 OMC 爬取结果**

| 维度 | OMC（Chaty） | ybb（自研 ChatWidget） |
|------|--------------|------------------------|
| 类型 | 第三方 App 浮动渠道钮 | 自定义 dialog + localStorage |
| 面板 | 外链渠道或 Chaty 托管 | 站内 mock 消息流 |
| 文案 | Chaty 后台配置 | `chat-config.ts` B2B 文案 |
| 存储 | Chaty / 渠道 SDK | `localStorage shopifyChatData` |

### 对齐建议（待产品确认）

1. **跟 OMC 一致**：集成 Chaty（或同类：Tidio / Gorgias），配置 WhatsApp + Email 等渠道；移除自研 ChatWidget。
2. **跟截图一致（B2B 自研）**：保留 ChatWidget，但需在 `BENCHMARK_GAP_MATRIX.md` 标注为 **YBB 业务扩展**，不以 OMC 为基准。
3. **Shopify Inbox**：OMC 当前**未使用**；若 YBB 用 WC 可考虑官方 Inbox 插件，但与 OMC 视觉不一致。

---

## 3. 复现命令

```powershell
Set-Location "D:\开发\fishAgent\总包\skill\reverse-skill\omc-replica\ybb-site"
node scripts/audit-omc-newsletter-chat.mjs
node scripts/audit-omc-footer.mjs   # footer 全量（含 newsletter 尺寸）
```

---

## 4. 网络请求（newsletter / chat）

- `GET cdn.chaty.app/pixel.js` — Chaty 主脚本
- `POST prod-api.chaty.app/api/pixel/widgets` — Chaty 渠道配置
- `GET customer-first-focus.b-cdn.net/*` — 评价组件（非 chat）
- Newsletter 提交走表单 `POST /contact`（页面内，非 XHR）
