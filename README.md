# ybb-site

**YBB（Young Boy Baits）** 独立站前端 — 基于 [omctackle.com](https://www.omctackle.com) 像素级复刻的 Next.js 静态站，与 WordPress / WooCommerce 混合部署于 [carp-ybb.com](https://carp-ybb.com)。

| 项 | 说明 |
|----|------|
| 生产域名 | https://carp-ybb.com |
| 基准站 | https://www.omctackle.com |
| 业务定位 | 欧鲤钓源头工厂 B2B（批发 / OEM / 样品询盘） |
| Agent 规则 | [`AGENTS.md`](./AGENTS.md)（复刻协议、部署硬性规则） |
| **Agent Skills** | [`skills/`](./skills/)（如 Shopify 独立站上货 [`shopify-shangjia`](./skills/shopify-shangjia/)） |
| 父级规格 | [`../REPLICA_PROMPT.md`](../REPLICA_PROMPT.md)、[`../BENCHMARK_GAP_MATRIX.md`](../BENCHMARK_GAP_MATRIX.md) |

---

## 技术栈

| 层 | 技术 |
|----|------|
| 框架 | Next.js 15（App Router）+ React 19 + TypeScript |
| 样式 | Tailwind CSS v4、`app/globals.css` 设计 token |
| 状态 | Zustand（购物车等客户端状态） |
| 轮播 | Embla Carousel |
| 静态导出 | `output: 'export'` → `out/` |
| 后台 | WordPress mu-plugins + WooCommerce |
| 部署 | SiteGround（浏览器 File Manager 为主） |

---

## 架构概览

生产环境为 **静态 Next 站 + WordPress 共存**：

```
┌─────────────────────────────────────────────────────────────┐
│  carp-ybb.com / public_html                                 │
├─────────────────────────────────────────────────────────────┤
│  静态层（out/）          │  WordPress / WooCommerce         │
│  首页、类目、PDP、内容页   │  wp-admin、wp-json、checkout     │
│  _next/static/*          │  购物车结账、账户、评价 REST      │
└─────────────────────────────────────────────────────────────┘
         ▲                              ▲
         │ build-static.ps1             │ mu-plugins REST
         │ deploy-siteground-browser    │ Woo Store API
         └──────── ybb-site ────────────┘
```

**数据流要点：**

- **产品列表 / PDP 静态 HTML**：`node scripts/sync-from-wp.mjs` 从 Woo 拉已发布 SKU → `lib/data/products.json` → `npm run build`。
- **首页可配置模块**（Hot Products、Latest Stories、导航、Hero 等）：客户端 `fetch` WordPress REST，**改后台配置无需 rebuild**。
- **购物车 / 结账**：前端加购 → Woo Store API → `/checkout/`（WordPress 主题页）。
- **Contact 表单**：`POST /wp-json/ybb/v1/contact-inquiry` → Gmail SMTP → 收件箱。

---

## 目录结构

```
ybb-site/
├── app/                    # Next.js 路由与页面
│   ├── page.tsx            # 首页
│   ├── collections/        # 类目列表 / 详情
│   ├── products/           # PDP、评价页
│   ├── pages/contact/      # 联系我们
│   └── globals.css         # OMC 设计 token
├── components/             # UI 组件（Header、MegaMenu、ProductCard…）
├── lib/
│   ├── data/               # 构建期 JSON（products、collections、navigation…）
│   ├── site-manager/       # WP REST 客户端（导航、Hero、Contact…）
│   ├── woocommerce/        # Store API、购物车、评价
│   └── i18n/               # 多语言（en / zh / ja）
├── deploy/
│   ├── wp-content/mu-plugins/   # WordPress 插件源码（上线前上传）
│   ├── htaccess.snippet         # 路由规则模板
│   └── upload-manifest.json     # 增量部署基线
├── scripts/                # 构建、部署、审计、同步脚本
├── docs/                   # 部署与 Site Manager 文档
├── out/                    # 静态导出产物（gitignore）
└── secrets.local.json      # 本地凭证（gitignore，勿提交）
```

---

## 本地开发

### 环境要求

- Node.js 18+
- npm

### 安装与启动

```powershell
Set-Location "D:\开发\fishAgent\总包\skill\reverse-skill\omc-replica\ybb-site"
npm install
npm run dev
```

默认开发地址：http://localhost:3000

### 常用命令

| 命令 | 说明 |
|------|------|
| `npm run dev` | 开发服务器（Turbopack） |
| `npm run build` | 生产构建（改 UI/组件后必跑） |
| `npm run dev:restart` | 重启 dev（`scripts/restart-dev.ps1`） |
| `npm run dev:stop` | 停止 dev 进程 |
| `npm run build:static` | 同步 WP 数据 + 构建 + 可选部署 |
| `npm run lint` | ESLint |

### 开发收尾（改 UI 后必做）

```powershell
npm run build
powershell -ExecutionPolicy Bypass -File scripts/restart-dev.ps1
# 确认 http://localhost:3000 返回 200
```

细则见 [`AGENTS.md` → Phase 4.5](./AGENTS.md)。

---

## 构建与静态导出

```powershell
# 从生产 Woo 同步已发布商品（默认路径）
node scripts/sync-from-wp.mjs --site https://carp-ybb.com

# 构建静态站（含 sync）
powershell -ExecutionPolicy Bypass -File scripts/build-static.ps1

# 仅构建、不上线
powershell -ExecutionPolicy Bypass -File scripts/build-static.ps1 -SkipDeploy
```

产物目录：`out/`（数千 HTML + `_next/static/`）。

> `--from-catalog` 仅用于离线预览，**生产禁用**。

---

## 生产部署

**权威规则：** [`AGENTS.md` → carp-ybb.com 生产部署](./AGENTS.md)  
**浏览器部署细则：** [`docs/siteground-browser-deploy.md`](./docs/siteground-browser-deploy.md)

### 通道分工

| 场景 | 做法 |
|------|------|
| 静态站全量（buildId 变更、大改版） | `scripts/deploy-siteground-browser.ps1` |
| 静态站增量（少量 HTML/chunk） | SiteGround File Manager 手动覆盖 |
| mu-plugin 更新 | File Manager → `wp-content/mu-plugins/` |
| Woo 上架 / 后台配置 | Playwright / wp-admin（**禁止**用 FTPS 当上架手段） |
| 仅改 WP 首页 REST 配置 | 无需上传；REST 即时生效 |

### 标准全量流程

```powershell
powershell -ExecutionPolicy Bypass -File scripts\build-static.ps1
powershell -ExecutionPolicy Bypass -File scripts\deploy-siteground-browser.ps1 -SkipBuild
py scripts\verify-remote-deploy.py
```

### 部署后验收

- 首页 HTTP 200，`index.html` body > 50KB
- 远程 buildId 与本地 `out/index.html` 注释一致
- 引用的 `_next/static/chunks/*` 返回 200
- SiteGround **Purge Cache**（避免 `/` 与 `/index.html` 缓存分叉）

> FTPS（`deploy_ftps.py`、`upload-mu-plugins.py`）仅作**紧急备用**；默认禁止 Agent 自动跑 FTPS。

---

## WordPress 集成

### YBB 站点管理（Site Manager）

后台菜单：**YBB 站点管理**（`deploy/wp-content/mu-plugins/ybb-site-manager/`）

| 模块 | REST | 即时生效 |
|------|------|----------|
| 导航 / 公告 / Hero | `/ybb/v1/site-manager/*` | 是 |
| Hot Products / Latest Stories | `/ybb/v1/hot-products` 等 | 是 |
| Contact 页邮箱 / 文案 | `/ybb/v1/site-manager/contact` | 是 |

文档：[`docs/ybb-site-manager/`](./docs/ybb-site-manager/)（PRD、REST 规格、运营 runbook）

上传 mu-plugin：

```powershell
node scripts/open-siteground-chrome.mjs
# File Manager → public_html/wp-content/mu-plugins/
py scripts/upload-mu-plugin-file.py ybb-contact-inquiry.php   # 紧急 FTPS 单文件
```

### Contact 询盘

| 项 | 路径 / 端点 |
|----|-------------|
| 前台表单 | `app/pages/contact/ContactForm.tsx` |
| REST 提交 | `POST /wp-json/ybb/v1/contact-inquiry` |
| mu-plugin | `deploy/wp-content/mu-plugins/ybb-contact-inquiry.php` |
| 后台设置 | `wp-admin` → 设置 → YBB Contact |
| 邮件状态 | `GET /wp-json/ybb/v1/contact-mail-status` |

收件邮箱与 SMTP 在 `ybb_contact_settings`；公开页 `salesEmail` 与询盘收件箱对齐。

### 商品评价

- 列表：`GET /wp-json/ybb/v1/product-reviews/{wcId}`
- 发表：iframe embed → `/wp-json/ybb/v1/product-reviews-embed/{wcId}`
- mu-plugin：`ybb-product-reviews.php`（**无需 rebuild** 即可上线 PHP 变更）

---

## OMC 复刻协议（摘要）

对齐 omctackle.com 时须遵守 **Benchmark-First Replication Protocol**（Phase 0→5）：

1. **Scope** — 锁定组件、URL、viewport
2. **Crawl** — 先跑 audit 脚本，记录 computed styles / 动效
3. **Gap matrix** — 对照 `BENCHMARK_GAP_MATRIX.md`
4. **原子实现** — 结构 + 样式 + 交互 + 动画一次交付
5. **Verify** — `node ../scripts/audit-ybb-vs-omc-full.mjs`

组件级 audit 脚本位于 `scripts/audit-omc-*.mjs`。完整规则见 [`AGENTS.md`](./AGENTS.md)。

---

## 关键脚本索引

| 脚本 | 用途 |
|------|------|
| `scripts/sync-from-wp.mjs` | 从 Woo 同步商品到 `lib/data/` |
| `scripts/build-static.ps1` | sync + build + 打 zip |
| `scripts/deploy-siteground-browser.ps1` | 全量浏览器部署 |
| `scripts/restore-htaccess-siteground.ps1` | 修复路由 `.htaccess` |
| `scripts/verify-remote-deploy.py` | 部署后远程验收 |
| `scripts/restart-dev.ps1` | 重启本地 dev |
| `scripts/configure-outlook-smtp.py` | 配置生产 Contact SMTP |
| `scripts/probe-contact-mail.py` | 端到端询盘邮件探测 |
| `scripts/upload-mu-plugin-file.py` | 紧急 FTPS 单文件 mu-plugin 上传 |
| `scripts/ybb-deploy-runner.ps1` | WP 后台触发的部署队列 Runner |

---

## 凭证与配置

本地创建 `secrets.local.json`（已 gitignore），包含：

- `ftp` — SiteGround FTPS（紧急备用）
- `wordpress` — wp-admin 登录
- `deploy` — SiteGround siteToolsSiteId、runnerKey
- `gmail` / `outlook` — Contact SMTP（勿写入仓库）

模板字段见团队内部文档；**禁止**将密钥提交到 git。

---

## 相关项目

| 项目 | 路径 | 说明 |
|------|------|------|
| omc-replica | `../` | 复刻总包、全站 audit、差距矩阵 |
| ybb-php | `../ybb-php/` | Laravel 全栈替代方案（与 WP 解耦） |
| reverse-skill | `../../` | 工作区 Skill 包与 Agent 规则 |

---

## 文档索引

| 文档 | 内容 |
|------|------|
| [`AGENTS.md`](./AGENTS.md) | Agent 硬性规则（复刻 + 部署 + 首页模块） |
| [`docs/siteground-browser-deploy.md`](./docs/siteground-browser-deploy.md) | SiteGround 浏览器部署 |
| [`docs/ybb-site-manager/DEV-RUNBOOK.md`](./docs/ybb-site-manager/DEV-RUNBOOK.md) | Site Manager 开发 runbook |
| [`docs/ybb-site-manager/REST-SPEC.md`](./docs/ybb-site-manager/REST-SPEC.md) | REST API 规格 |
| [`docs/quorlyx-integration-guide.md`](./docs/quorlyx-integration-guide.md) | Quorlyx 客服嵌入 |

---

## License

Private — 仅供 YBB / carp-ybb.com 项目内部使用。
