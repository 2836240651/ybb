# OMC 复刻项目 Agent 规则（ybb-site）

本文件供 Cursor / AI Agent 在 **OMC → ybb-site 像素级复刻** 工作时遵循。  
工作区根目录：`<YBB_ROOT>` = `D:\开发\fishAgent\总包\skill\reverse-skill\omc-replica\ybb-site`  
基准站（benchmark）：https://www.omctackle.com  
父级文档：`../REPLICA_PROMPT.md`、`../BENCHMARK_GAP_MATRIX.md`

**核心原则**：先研究 OMC **如何实现**，再写代码；一次把一个组件做到位（含 micro-interactions），不要等用户逐条指出缺动画、缺 hover、缺字重。

---

## Benchmark-First Replication Protocol（硬性规则）

接到任何「对齐 OMC」「修差距」「复刻某组件」任务时，**必须**按 Phase 0→5 顺序执行。跳过 Phase 1–2 直接改 JSX/CSS 视为违规。

### Phase 0 — Scope（范围锁定）

在动手前写明：

| 字段 | 示例 |
|------|------|
| OMC 组件 | Mega Menu / Hero Carousel / AnnouncementBar |
| 基准 URL | `https://www.omctackle.com/` 或 `/collections/hardware` |
| Viewport | desktop `1440×900`、mobile `390×844`（与现有 audit 脚本一致） |
| 验收文件 | 对应 `*_AUDIT.md` 与 `../BENCHMARK_GAP_MATRIX.md` 行 |

### Phase 1 — Crawl before code（先爬再写）

**禁止**仅凭截图描述或用户口述实现。

1. 运行已有 audit 脚本（见下方 Reference commands）；若无对应脚本，用 Playwright 新建 crawl 并落盘 JSON。
2. 必须记录（computed styles，非猜测）：
   - `font-size` / `font-weight` / `line-height` / `letter-spacing` / `text-transform`
   - `padding` / `margin` / `gap` / `border-radius`
   - `color` / `background` / `opacity`
   - `transition` / `animation`：`duration`、`timing-function`、`delay`、`transform`、`opacity`
   - `z-index` / `overflow` / `pointer-events`
   - `:hover` / `:focus-visible` / `open` / `aria-expanded` 状态差异
3. 产出写入 `scripts/*-audit.json` 并更新或起草 `*_AUDIT.md`。

### Phase 2 — Gap matrix（差距矩阵）

对照 OMC 列出 **全部** 维度，再勾选实现项：

| 维度 | 检查项 |
|------|--------|
| Structure | DOM 层级、语义标签、`details`/`dialog` 模式 |
| Typography tokens | clamp/rem、uppercase、tracking、heading scale |
| Spacing | page-width inset、section padding、grid gap |
| Colors | CSS variables、`rgb()` 透明度、sale/accent |
| Interactions | hover opacity、btn-duplicate 填充、drawer 开关 |
| Motion | stagger 间隔、panel enter、crossfade、scroll hide |
| Responsive | 断点高度、mobile dock、carousel peek |
| i18n / copy | OMC 固定文案模式（非自造 B2B 标签） |

矩阵汇总维护在 `../BENCHMARK_GAP_MATRIX.md`；组件级细节写在 `*_AUDIT.md`。

### Phase 3 — Implement atomically（原子实现）

- **一次一个组件、端到端**：结构 + 样式 token + 交互 + 动画，同一 PR/任务内完成。
- **禁止**只交「布局壳子」：例如 Mega Menu 仅有 grid 而无 sidebar stagger / tab crossfade。
- 改 `globals.css` token 时对照 OMC theme variables（`--animation-*`、`--rounded-*`、`ease-nav`）。
- 业务映射（工厂 B2B）仅替换 **数据与文案**，不改动 OMC 已固定的 **布局与动效模式**（见 `REPLICA_PROMPT.md` A.1.0）。

### Phase 4 — Verify（验证）

用户不应再需要肉眼发现「动画没了」。

1. 本地 dev 健康：`http://localhost:3000` 返回 200。
2. 重跑相关 audit 脚本；全站回归：
   ```powershell
   Set-Location "D:\开发\fishAgent\总包\skill\reverse-skill\omc-replica"
   node scripts/audit-ybb-vs-omc-full.mjs
   ```
3. 有截图目录时做 side-by-side（`audit-screenshots/`）。
4. 在 `BENCHMARK_GAP_MATRIX.md` 将对应行标为 ✅ 或注明剩余 🟡 及原因。


### Phase 4.5 — 开发收尾（硬性）

**任意一批**影响 UI / 运行时行为的代码改动完成后，在向用户汇报「任务完成」之前，**必须**执行：

1. `npm run build` — 必须通过，方可视为完成
2. `powershell -ExecutionPolicy Bypass -File scripts/restart-dev.ps1`（若 3000 端口被占用，加 `-Port 3001`）
3. 确认首页或本次改动涉及的路由返回 HTTP 200
4. 向用户汇报最终可访问 URL（默认 `http://localhost:3000`）
5. 若 build 失败或 dev 返回 500：按常见坑处理 — `scripts/stop-dev.ps1` → 删除 `.next` → 再执行步骤 2

**禁止**在未完成 build + 重启 dev 的情况下将任务标为完成，除非用户明确说明「仅文档 / docs only」。

### Phase 5 — Document（文档）

- 更新本组件 `*_AUDIT.md`：OMC 实测表、YBB gaps、已改文件列表。
- 若新增 crawl 脚本，在 audit 文首注明命令与 JSON 路径。

---

## When visual isn't enough（逆向学习）

肉眼对比不够时，按序深挖：

1. **OMC theme CSS class** — 在 live 站或 theme 参考中查 `btn-duplicate`、`interaction-*`、`with-block`、`mega-menu__*`、`slideshow` 等。
2. **Playwright 状态探测** — `hover()` / `focus()` / 打开 `details[open]`，读 `getComputedStyle` 前后差异（见 `../scripts/audit-omc-interactions.mjs`）。
3. **已有 crawl JSON** — `scripts/omc-*-audit.json`、`../scripts/omc-*.json`，先读再改代码。
4. **`globals.css` vs OMC** — 对比 `--animation-smooth`、`--animation-nav`、`--gap-padding`、`cubic-bezier` 是否与 audit 一致。
5. **Animation 清单**（每项都要有据）：
   - duration（ms / s）
   - easing（如 `cubic-bezier(0.075, 0.82, 0.165, 1)`）
   - transform（`translateY`、`scale`）
   - opacity 起止值
   - stagger：`delay = base + index * step`

网络层（可选）：主题 `asset_url`、section JSON、Shopify section schema——仅当 DOM/CSS 无法解释行为时使用。

---

## Anti-patterns（禁止）

| 禁止行为 | 正确做法 |
|----------|----------|
| 仅凭截图/用户描述写组件 | Phase 1 crawl + JSON |
| 只交布局，无 hover/motion/typography audit | Phase 3 原子交付 |
| 用户报一处修一处，不查兄弟元素 | 同区域整表扫描 Gap matrix |
| 自造 B2B 侧栏标签（Services、For Buyers…）当 OMC 是 Collections | 跟 OMC 文案/结构，业务差异走数据配置 |
| 跳过 `audit-ybb-vs-omc-full.mjs` 声称完成 | Phase 4 全站回归 |
| 猜测 `0.3s ease` | 从 audit 抄 measured `transition` |

---

## Per-component checklist（组件验收模板）

复制下列清单到任务描述或 PR；**全部勾选**才可标 ✅。

### Header / Mega Menu

- [ ] 3-zone grid：`175px | 1fr | 118px`，sticky + scroll hide `translateY(-100%)` 0.5s
- [ ] Nav pill：`btn-duplicate` hover 填充 + active scale
- [ ] Mega：`details-mega` 面板 `translateY(-8px→0)` + opacity
- [ ] Sidebar stagger 100ms；product grid stagger 100ms；tab hover crossfade
- [ ] `All {Child} (N) →`、`Shop {Category} →`、SOLD OUT 竖标
- [ ] 脚本：`node scripts/audit-omc-mega-menu.mjs`、`node scripts/audit-omc-header-scroll.mjs`

### Announcement Bar

- [ ] 高度 48px；marquee 无缝循环；hover pause
- [ ] 脚本：`node scripts/audit-omc-announcement-bar.mjs`

### Hero Carousel

- [ ] 圆角卡片、gap、adjacent peek；7s autoplay；~700ms slide
- [ ] 渐变 overlay；heading `title-sm` scale；dots 24px hit area
- [ ] 脚本：`node scripts/audit-omc-hero.mjs`

### Product Cards

- [ ] aspect-square；title+price 同行；hover image scale ~1.02
- [ ] overlay 按钮 stagger；Quick View；SOLD OUT `.badge--vertical`
- [ ] 脚本：`../scripts/audit-omc-interactions.mjs`（productCard* probes）

### Footer

- [ ] 4 区栅格；newsletter 圆角 input + 40px 圆形 submit
- [ ] 链接 underline `background-size` 动画；16 支付图标
- [ ] 脚本：`node scripts/audit-omc-footer.mjs`

### Drawers / Modals（Search、Cart、MobileNav、Filter）

- [ ] overlay opacity ~0.4；panel slide + `ease-nav`
- [ ] open 时 `body` scroll lock；关闭延迟与 `pointer-events` 时序
- [ ] mobile item stagger（如 55ms）

### Buttons / Links hover fill

- [ ] 记录 `transition-property` / `duration` / `timing-function`
- [ ] CTA、footer link、carousel arrow、add-to-cart 逐条对照 `INTERACTIONS_AUDIT.md`
- [ ] 脚本：`../scripts/audit-omc-interactions.mjs`

---

## Reference commands

在 `<YBB_ROOT>` 下（组件级脚本）：

```powershell
Set-Location "D:\开发\fishAgent\总包\skill\reverse-skill\omc-replica\ybb-site"
node scripts/audit-omc-hero.mjs
node scripts/audit-omc-mega-menu.mjs
node scripts/audit-omc-announcement-bar.mjs
node scripts/audit-omc-header-scroll.mjs
node scripts/audit-omc-footer.mjs
node scripts/audit-omc-home-bottom.mjs
```

在 `omc-replica` 根目录（全站 / 交互）：

```powershell
Set-Location "D:\开发\fishAgent\总包\skill\reverse-skill\omc-replica"
node scripts/audit-ybb-vs-omc-full.mjs
node scripts/audit-omc-interactions.mjs
node scripts/audit-omc-typography.mjs
node scripts/audit-omc-nav-pill-page-transition.mjs
```


开发收尾（每次改 UI/运行时后必做）：

```powershell
Set-Location "D:\开发\fishAgent\总包\skill\reverse-skill\omc-replica\ybb-site"
npm run build
powershell -ExecutionPolicy Bypass -File scripts/restart-dev.ps1
# 验证: Invoke-WebRequest http://localhost:3000 -UseBasicParsing
```

详见上文 **Phase 4.5 — 开发收尾（硬性）**。

---

## WP 首页可配置模块（硬性规则）

**目标**：后台改 Hot Products / Latest Stories 等配置 **不得** 拖垮整站；新增同类模块 **不得** 重复 hydrate 事故。

**参考实现**：`HotProductsCarousel.tsx`、`BlogCarousel.tsx`、`deploy/wp-content/mu-plugins/ybb-site-manager/`（**YBB 站点管理** — 导航/公告/Hero/首页模块统一后台）

**文档**：`docs/ybb-site-manager/`（PRD、REST、运营/开发 runbook）

| 模块 | REST | 即时生效（无 redeploy） |
|------|------|-------------------------|
| Hot Products / Latest Stories | `/ybb/v1/hot-products` 等 | 是 |
| 导航 / 公告 / Hero | `/ybb/v1/site-manager/*` | 是 |
| 视频 / Featured / 品牌 | `/ybb/v1/site-manager/factory-video` 等 | 是 |
| 新产品 PDP | — | Phase 3 自动 deploy（`scripts/ybb-deploy-runner.ps1`） |

**mu-plugin 上传（Site Manager）**：`py scripts/upload-ybb-site-manager.py` 或 File Manager 上传 `ybb-site-manager/` + `ybb-site-manager-loader.php`

**旧插件**：`ybb-home-settings.php` / `ybb-site-brand.php` 仍并存；Site Manager REST 优先。新配置请用 **YBB 站点管理** 菜单。

### 固定架构（禁止分叉）

| 层 | 职责 | 路径 |
|----|------|------|
| WP mu-plugin | 后台表单、sanitize、REST JSON | `deploy/wp-content/mu-plugins/ybb-site-manager/`（主）；`ybb-home-settings.php`（legacy 别名） |
| Next 客户端组件 | `fetch` REST → 初始 `useState([])` → `ready` 后渲染 | `components/home/*Carousel.tsx` |
| 静态构建 | 只输出 **空壳**（不把假数据 bake 进 HTML） | 如 `lib/data/hot-products.json` → `{ "handles": [] }` |

### 新增可配置首页模块 checklist（全部勾选才可合并）

- [ ] REST：`GET /ybb/v1/<feature>` 返回 `enabled` + 列表
- [ ] sanitize：**POST 未带的字段必须保留**（partial save 不得清空其他模块）
- [ ] 组件：初始 `[]` + `ready`；`ready && !items.length` → `return null`
- [ ] **禁止** `useState(staticFallback)` 用本地 catalog 预填真实产品/文章
- [ ] **禁止** 在 `app/layout.tsx` 挂载 `*Runtime` 或注入 hydrate `<script>`
- [ ] **禁止** mu-plugin 输出带 `MutationObserver` / 轮询 DOM 的 hydrate.js
- [ ] **禁止** `patch-index-*.php` 修改线上 `index.html`

### 变更分级（Agent 必须先判断通道）

| 改了什么 | 需要 `npm run build`? | 上线方式 |
|----------|------------------------|----------|
| 仅 WP 后台改配置（标题/图片/启用行） | **否** | 无需上传；REST 即时生效 |
| mu-plugin PHP（新字段 / REST / 后台 UI） | **否** | 浏览器 → `wp-content/mu-plugins/` |
| Next 组件 / 样式 / 静态数据文件 | **是** | `build-static.ps1` → 浏览器部署 |
| buildId 变化 / 大改版 | **是** | `deploy-siteground-browser.ps1` 全量 |

### 已废弃（不得再用）

| 脚本 / 模式 | 原因 |
|---------------|------|
| `upload-critical-chunks.py`、`publish-home-index.py`（FTPS） | `EOFError` 曾把 `index.html` 打成 **0 字节** |
| `upload-patch-home-hydrate.py`、`patch-index-home-hydrate.php` | hydrate 与 React 冲突 → **整页卡死** |
| `HotProductsRuntime` / `LatestStoriesRuntime` | 同上 |
| 非 no-op 的 `ybb-*-hydrate.php` | 同上 |

mu-plugin 上传：`node scripts/open-siteground-chrome.mjs` → File Manager 进入 `public_html/wp-content/mu-plugins/` → `upload-siteground-browser.mjs --files ... --wait-manual`。`upload-mu-plugins.py`（FTPS）仅紧急备用。

---

## carp-ybb.com 生产部署（Agent 硬性规则）

**权威文档即本文件本节。** 用户说「同步到 carp-ybb」「上线」「更新生产站」时，按下列流程执行。

**生产域名：** https://carp-ybb.com  
**凭证：** 仅 `secrets.local.json`（gitignore）  
**共存策略：** Next 静态站占 `public_html` 根；**保留** `wp-admin` / `wp-json` / WooCommerce。

### 通道分工（硬性 — 勿混用）

| 通道 | 做什么 | 用什么 | **禁止** |
|------|--------|--------|----------|
| **Woo 后台 / 产品 / 配置** | 上架产品、挂图、三语 meta、变体属性、Woo 设置、permalink、支付页模板 | **本地浏览器 + Playwright**（`D:\dev\独立站上架\wordpress\`）或 wp-admin 手动 | **禁止 FTPS** 上传 `sync-wc-products.php`、`upload-product-import.py`、改 `.htaccess` 当「后台配置」 |
| **A. 静态站全量** | `out/` 大改版、buildId 变更 | `scripts/deploy-siteground-browser.ps1`（SiteGround File Manager + PHP 触发） | 直接 FTPS 上传 zip/.htaccess |
| **B. 静态站增量** | 仅更新已 build 的前端 HTML/JS/CSS | **SiteGround 浏览器**上传 `out/index.html` + 变更 chunks → `verify-remote-deploy.py` | 默认 FTPS；Woo 配置 |
| **C. WP 类目（例外）** | Excel → `product_cat` | 浏览器 REST 或已有 PHP **仅当用户明确要求** | 与 A/B 同一轮混跑 |

**用户说「改后台 / 上架 / Woo 配置」** → 只走 **Woo 通道**（独立站上架 Skill），**不要**开 FTPS。  
**用户说「更新前端 / 同步静态站」** → 见下方 **「部署顺序（硬性）」**。

### 部署顺序（硬性 — 本地更新后必遵守）

**原则：先对齐 Ubuntu 部署机源码，再动 SiteGround。** 否则 `YBB 站点管理 → Sync` 会用 `/opt/ybb-site` 旧代码重建并覆盖 `public_html`，出现缺 PDP、buildId 错乱、页面爆。

| 步 | 动作 | 命令 / 入口 |
|----|------|-------------|
| 1 | 本地开发 + 构建验收 | `npm run build` 或 `build-static.ps1 -SkipDeploy` |
| 2 | **同步部署机**（完整源码，非 git diff） | `python scripts/sync-to-deploy-machine.py` |
| 3 | 确认远端 build exit 0 | 脚本内已执行；或 SSH `cd /opt/ybb-site && npm run build` |
| 4 | **再更新 SiteGround** | `deploy-siteground-browser.ps1`、后台 **Sync**，或部署机 `ybb-deploy-runner.sh --force` |
| 5 | 部署验收 | `verify-remote-deploy.py` + `product-sync-acceptance.py --post-deploy` |

**禁止：** 本地改完代码后直接 `deploy-siteground-browser.ps1` / FTPS / 本地上传 `out/`，而部署机仍是旧包。

`build-static.ps1`（不带 `-SkipDeploy`）已在步骤 4 前**自动**执行步骤 2。仅本地试 build 用 `-SkipDeploy`；紧急绕过部署机同步用 `-SkipDeployMachineSync`（须书面说明原因）。

```powershell
Set-Location "D:\开发\fishAgent\总包\skill\reverse-skill\omc-replica\ybb-site"

# 推荐：构建 → 同步部署机 → SiteGround（一步）
powershell -ExecutionPolicy Bypass -File scripts\build-static.ps1

# 或分步
powershell -ExecutionPolicy Bypass -File scripts\build-static.ps1 -SkipDeploy
python scripts\sync-to-deploy-machine.py
powershell -ExecutionPolicy Bypass -File scripts\deploy-siteground-browser.ps1 -SkipBuild
```

### 生产静态站唯一写入者（硬性）

`YBB 站点管理 → 部署状态 / Sync` 的作用是触发 **Ubuntu 部署机** 从 Woo/WP 拉取数据、构建静态包、上传 SiteGround，并回写部署状态；它 **不** 同步 Windows 本地代码。

本地改了前端代码、样式、构建脚本、静态生成逻辑后，必须先把代码同步到 Ubuntu 部署机 `/opt/ybb-site`，再由部署机执行 build/deploy 或等待其 runner 处理队列。**禁止** 在本地手动部署 SiteGround 的同时点击/保留后台 Sync 队列让部署机并行部署；两边会用不同代码与 buildId 覆盖同一份 `public_html`。

固定原则：

- **Woo 产品/图片/价格/多语覆盖变化**：可由 YBB 站点管理 Sync 触发部署机自动同步。
- **前端代码/样式/构建逻辑变化**：先同步到 Ubuntu 部署机，再由部署机部署；不要用本地 `out/` 直接覆盖生产。
- **紧急本地手动部署**：必须先确认部署队列非 pending，或临时停止 `ybb-deploy-runner`，部署完成并验收后再恢复，避免双写。

### 本地代码推部署机（硬性）

Ubuntu 部署机 `/opt/ybb-site` 当前按文件目录运行，**不得假设它是完整 git 工作树**。从 Windows 本地推代码到部署机时，必须使用 **完整源码同步清单**，禁止只同步 `git diff --name-only` 或“本次改动文件”。

原因：diff-only 会漏掉“本地已存在但远端缺失”的干净源码文件，导致部署机 `next build` 出现 `Module not found`，而旧 `out/` 可能继续被后续步骤复用，造成假 success。

同步规则：

- **必须包含**：`app/`、`components/`、`hooks/`、`lib/`、`public/` 中源码资产、`deploy/` 必要 PHP/htaccess、`scripts/`、`docs/`、`package*.json`、`next.config.ts`、`tsconfig.json` 等构建所需文件。
- **必须排除并在远端 `rsync --delete` 时 preserve**：`.git/`、`.venv/`、`.next/`、`out/`、`node_modules/`、`secrets.local.json`、`__pycache__/`、`*.pyc`、临时 zip/bak、`deploy/remote-backup/`、`deploy/i18n-patch-stage/`、`deploy/siteground-upload*/` 等生成物、缓存、备份、远端运行环境与敏感文件。
- **同步后必须验收**：远端确认关键文件存在；执行 `cd /opt/ybb-site && npm run build`，必须看到 build exit 0 后，才允许点击/触发 YBB 站点管理 Sync 或等待 runner 部署。

### WooCommerce 产品上架（本地 Playwright — 默认路径）

完整 Skill：`D:\dev\独立站上架\SKILL-WORDPRESS.md`

```powershell
cd D:\dev\独立站上架
node scripts/run-wp-pipeline.mjs --xlsx "产品表单.xlsx" --only-sheets 铅坠   # 单类目试点

cd wordpress
npm run open-chrome                    # 真实 Chrome，过 SiteGround 验证
npm run import:publish:batches         # Woo 后台「产品 → 导入」
npm run upload:images && npm run set:images && npm run set:i18n
npm run fix:variations && npm run verify:variations
```

前台数据：**Woo 上架多少，前台显示多少**（不得以 `wc-catalog.json` 全量写 `products.json`）：

```powershell
cd D:\开发\fishAgent\总包\skill\reverse-skill\omc-replica\ybb-site
node scripts/sync-from-wp.mjs --site https://carp-ybb.com   # 只拉 Woo Store 已发布 SKU
powershell -ExecutionPolicy Bypass -File scripts\build-static.ps1 -SkipSync
# 然后才走下方静态站 A/B 部署
```

`--from-catalog` **仅离线预览**，生产禁用。

### 商品评价（Woo `review_count` → 静态站）

| 项 | 说明 |
|----|------|
| 数据源 | Woo Store API `review_count` / `average_rating`（`sync-from-wp.mjs` 写入 `products.json`） |
| 前台入口 | PDP / Quick View / Featured — `ProductPurchasePanel` 内「好评 {n}+」链至 `/products/{handle}/reviews` |
| 实时数 | 徽章 **客户端**再拉 `/wc/store/v1/products/{wcId}`，Woo 后台改评价数后 **无需 rebuild** 即可更新徽章 |
| 评价列表 | 静态页 client fetch `GET /wp-json/ybb/v1/product-reviews/{wcId}`（mu-plugin `ybb-product-reviews.php`） |
| 发表评价 | iframe → `/wp-json/ybb/v1/product-reviews-embed/{wcId}`（Woo 原生评论表单；**须** `Content-Type: text/html`） |
| 后台 CRUD | Woo → 产品 → 评价：增删改 **仅 Woo**；前台只读 + 用户提交（待审核） |

**首次上线 / mu-plugin 变更：** 浏览器或 FTPS 上传 `deploy/wp-content/mu-plugins/ybb-product-reviews.php`（**无需 rebuild**）。

**评价多为 0 时：** 前台仍显示「查看评价」链至评论页；有已批准评价后显示「好评 N+」。

**静态 HTML 中的评价数：** 仍依赖 `sync-from-wp` + `build`；徽章以 Store API 为准。  
**部署：** 见下方 **「单 SKU 试错部署（硬性）」** — 禁止未验收即 FTPS 全站 `products/**`。

### 单 SKU 试错部署（硬性）

Next 静态导出：**组件源码通用**，但每个 SKU 有独立 `products/{handle}.html`（及可选 `reviews.html`），HTML 内 **写死** 当次 build 的 `_next/static/chunks/{hash}.js` 引用。  
改通用组件 → build 产生 **新 hash chunk** → 只需上传 **该 chunk 文件 + 要验证的 SKU 的 HTML**；**不必**先传 489×2 个商品页。

#### 流程（必须按顺序）

| 步 | 动作 |
|----|------|
| 1 | 本地 `npm run build` |
| 2 | **单 SKU FTPS**（见下方命令）— 默认试点 `tz-eldz-012` 或任务指定 handle |
| 3 | mu-plugin 若改 PHP：单独 `upload-mu-plugins.py` 或浏览器传 **一个** php |
| 4 | **验收**（试点 URL 全 200 + 功能） |
| 5 | **通过后** 再批量：全量 zip（`deploy-siteground-browser.ps1`）或 `deploy_ftps_reviews_patch.py`（**紧急备用**，勿默认） |

#### 单 SKU 命令

```powershell
Set-Location "D:\开发\fishAgent\总包\skill\reverse-skill\omc-replica\ybb-site"

# 清单（不上传）
py scripts/deploy_ftps_single_product.py --handle tz-eldz-012 --dry-run

# 上传：PDP + reviews + 两页引用的 chunks  only
py scripts/deploy_ftps_single_product.py --handle tz-eldz-012
```

**试点验收 URL（优先 `.html`，clean URL 另修 htaccess）：**

- PDP：`https://carp-ybb.com/products/tz-eldz-012.html` → 「查看评价」
- 评论页：`https://carp-ybb.com/products/tz-eldz-012/reviews.html`
- REST：`/wp-json/ybb/v1/product-reviews/{wcId}`
- Embed：`/wp-json/ybb/v1/product-reviews-embed/{wcId}` → 须为 HTML 表单，非 JSON 源码

#### Agent 禁止（静态试错）

| 禁止 | 正确做法 |
|------|----------|
| 改 ProductPurchasePanel / 评论相关组件后 **直接** `deploy_ftps_reviews_patch.py` 或扫全 `products/**` | 先 `--handle` 单 SKU 试错 |
| 未 build 就 FTPS 上传 | 先 `npm run build`，再传 `out/` 中对应文件 |
| build 进行中 FTPS 读 `out/` | 等 build 结束；避免 FileNotFound / EBUSY |
| 单 SKU 未验收就宣布「评论功能已上线」 | 完成上表 4 项验收 |
| 假设「通用组件 = 只传一个 chunk 全站生效」 | 还要传 **引用该 chunk 的 SKU 的 HTML**（或全量 HTML） |

#### 为何 `deploy_ftps_reviews_patch.py` 会列出 ~1965 文件？

脚本把 manifest 里 **size 变了的所有 `products/**`** 都列入上传 — 是 **批量策略**，不是架构要求。  
单 SKU 通过后，批量脚本用于 **其余 handle**；chunk 若已在单 SKU 步骤上传且 hash 未变，批量时可能跳过（取决于 manifest）。

### Agent 禁止（Woo vs FTP）

| 禁止 | 正确做法 |
|------|----------|
| FTPS 上传 `deploy/sync-wc-products.php` 批量上架 | `独立站上架` Playwright CSV 导入 |
| FTPS 上传 `product-import/` 当上架手段 | 同上 |
| 用 FTPS 改 Woo permalink / 结账页 / 账户页 | wp-admin 或 Playwright |
| `sync-from-wp --from-catalog` 写出 500+ 未上架商品 | 默认 `sync-from-wp`（Woo-first） |
| 产品任务收尾时顺手 `deploy_ftps.py` | 仅用户明确要求「更新前端到服务器」时 |
| **FTPS 直接上传 `.htaccess` / 全量 zip** | `deploy-siteground-browser.ps1` 或 `restore-htaccess-siteground.ps1` |

---

**历史说明：** 下方「三条通道」表中 C 为类目 PHP；**产品上架不再走服务器 PHP 管道**，除非用户书面要求回退。

### 三条通道（静态 + 类目 — 勿与 Woo Playwright 混）

| 通道 | 用途 | 命令 |
|------|------|------|
| **A. 静态站全量** | buildId 变更、首次对齐、大改版 | `scripts/deploy-siteground-browser.ps1` |
| **A2. 仅修路由/.htaccess** | clean URL 404、checkout/wp-json 失效 | `scripts/restore-htaccess-siteground.ps1` |
| **B. 静态站增量** | 已有 `deploy/upload-manifest.json` 的小改 | 浏览器上传单文件；`deploy_ftps.py` 仅备用 |
| **C. WP 类目** | Excel → `product_cat`，不动 HTML | 浏览器 REST 优先；PHP 仅备用 |

用户说「网站同步更新」「更新前端」= **通道 A 或 B**（且必须先 build），不是 Woo 后台操作。

### 标准流程（静态站）

顺序见上一节 **「部署顺序（硬性）」**：**部署机 → SiteGround**。

```powershell
Set-Location "D:\开发\fishAgent\总包\skill\reverse-skill\omc-replica\ybb-site"

# 1. 构建 + 同步部署机 + SiteGround（默认推荐）
powershell -ExecutionPolicy Bypass -File scripts\build-static.ps1

# 仅构建不上线（不同步部署机、不上传）
powershell -ExecutionPolicy Bypass -File scripts\build-static.ps1 -SkipDeploy

# 2. 单独部署（须先跑 sync-to-deploy-machine.py）
python scripts\sync-to-deploy-machine.py
powershell -ExecutionPolicy Bypass -File scripts\deploy-siteground-browser.ps1 -SkipBuild

# 仅修复 .htaccess / 路由
powershell -ExecutionPolicy Bypass -File scripts\restore-htaccess-siteground.ps1

# 打开 SiteGround File Manager（Chrome）
node scripts/open-siteground-chrome.mjs

# 日常小改（manifest 已存在且仅少量文件 size 变更时，备用）
py scripts/deploy_ftps.py --dry-run
py scripts/deploy_ftps.py
```

**浏览器部署细则**：`docs/siteground-browser-deploy.md`

### Agent 硬性规则

0. **部署顺序**：本地前端/数据变更后，**必须先** `python scripts/sync-to-deploy-machine.py`（或 `build-static.ps1` 默认流程），**再** SiteGround 上传或后台 Sync。禁止跳过部署机同步直接 `deploy-siteground-browser.ps1` / FTPS（`-SkipDeployMachineSync` 仅紧急例外）。
1. **先比对 buildId**：读 `out/index.html` 与 `https://carp-ybb.com/index.html` 注释中的 buildId；一致则汇报「已同步」，勿重复全量上传。
2. **无 `deploy/upload-manifest.json` ≠ 服务器空站**；不得打印「首次部署」并触发 638 文件 FTPS。无 manifest 时用 **`deploy-siteground-browser.ps1`**。
3. **全量 / buildId 变了** → 只用 `deploy-siteground-browser.ps1`（File Manager 上传 zip + `unzip-export.php` + `restore-htaccess.php`/`htaccess.restore` + 路由验收）。
4. **禁止**把 WC 类目 PHP 同步与静态站全量 FTPS 混在同一轮任务。
5. **部署后验收**：首页 HTTP 200；远程 buildId 与本地一致；必须校验线上 `index.html` 实际引用的 `_next/static` CSS/JS 返回 200，禁止只看上传日志判定成功。
6. **zip 部署后必清理**服务器上的 `ybb-static-export.zip`、`unzip-export.php`。
7. **缓存分叉硬规则（必须）**：如果用户反馈“线上炸版/单图铺满/样式缺失”，必须同时对比 `https://carp-ybb.com/` 与 `https://carp-ybb.com/index.html` 的 HTML 注释 buildId 与 CSS chunk 引用是否一致；若出现 `/` 与 `/index.html` 返回不同版本（缓存层 split-cache），需要：
   - 在 `deploy/htaccess.snippet` 中加入根路径统一与首页禁缓存规则（避免 `/` 与 `/?x=y` 命中不同包）
   - **并要求在 SiteGround / SG Optimizer 执行 Purge Cache**，否则 `.htaccess` 更新可能长期不生效（缓存未回源）
8. **少量更新默认 SiteGround 浏览器单文件**；`deploy_ftps.py` **仅紧急备用**（曾 EOFError / 0 字节 index）。禁止 Agent 默认跑 FTPS。选型见 **「SiteGround 文件上传选型」**。
9. **禁止临时开新路径发布**：固定使用 `scripts/deploy-siteground-browser.ps1`、`scripts/restore-htaccess-siteground.ps1`、`deploy/htaccess.snippet`、`deploy/upload-manifest.json`；不得在 `public_html` 临时新建平行目录做发布绕行。
10. **`.htaccess` 禁止 FTPS 直传**：必须用 `restore-htaccess-siteground.ps1`（浏览器上传 `htaccess.restore` + `restore-htaccess.php` 后 HTTP 触发）。
11. **任何静态上传后必跑** `py scripts/verify-remote-deploy.py`；并确认远程首页 body **> 50KB**、无 `ybb-*-hydrate` script 标签。

### carp-ybb 页面逻辑落成规则（长期执行）

1. **页面归属固定**：
   - 首页/类目/PDP/内容页：走 `out/*.html` 静态页面
   - 支付与账户：走 Woo/WordPress（`/checkout`、`/my-account`、`/wp-json`）
2. **路由优先级固定**：`deploy/htaccess.snippet` 必须确保 clean URL 先映射静态 `.html`，再让 WordPress 兜底。
3. **购物车链路固定**：前端只做加购与跳转；结账最终落到 Woo checkout，不走询价流程。
4. **变体访问固定**：旧变体 URL 必须 301 到母体 PDP（规则来源 `deploy/product-import/variant-redirects.json`）。

### SiteGround 文件上传选型（硬性 — Agent 与用户均遵守）

**原则：** 按「文件数量 × 单文件大小 × 风险」选通道；**禁止**用一条通道硬套所有场景。  
**权威细则：** 本节 + `docs/siteground-browser-deploy.md`。  
**验收：** 任何静态/mu-plugin 上传后 **必跑** `py scripts/verify-remote-deploy.py`；全量或 `.htaccess` 变更后 **必 Purge Cache**（SiteGround Speed Optimizer）。

#### 选型总表

| 场景 | 典型体量 | **最优解（默认）** | 次选（用户知情） | **禁止** |
|------|----------|-------------------|------------------|----------|
| **静态站全量** | `out/` 数百 MB、数千文件 | **浏览器**传 4 个部署物 → `unzip-export.php` 服务器解压（`deploy-siteground-browser.ps1`） | — | FTPS 批量传整个 `out/`；FTPS 直传 zip/.htaccess |
| **静态站增量** | `index.html` + 数个新 hash chunk | **浏览器 File Manager** 手动覆盖（或 `upload-siteground-browser.mjs --wait-manual`） | `deploy_ftps.py`（manifest 增量、短连接） | 无 manifest 时 FTPS 全扫；只传 index 不传新 chunk |
| **多个小文件（同目录）** | 5–30 个 PHP/CSS/JSON | **本地 zip 一包** → FM 上传 → 服务器 **Extract** 解压到目标目录 | 浏览器逐个覆盖（≤10 个时） | FTPS 长连接连续传几十上百文件 |
| **单个大文件** | 5–50 MB（视频、zip、主题包） | **浏览器** File Manager 单文件上传 | **FTPS 单文件短连接**（`upload_file` / `vpn-upload-test.py` 测速）；传完用 FTPS `SIZE` 或 `verify-remote-deploy` 验收 | FTPS 多文件队列与全量混跑；用 HTTP 测测试目录当唯一验收（可能 403） |
| **mu-plugin** | 1 个 PHP 或 1 个目录 | 浏览器 → `public_html/wp-content/mu-plugins/`；目录用 **zip + FM 解压** | `upload-mu-plugins.py`（FTPS 紧急） | 与静态站全量 FTPS 同一轮混跑 |
| **WP 主题** | 数个 PHP（如 checkout 主题） | 浏览器 → `wp-content/themes/<name>/` | FTPS 单目录少量文件 | 未备份覆盖生产主题；部署仓库内**旧版假结账**主题 |
| **`.htaccess` / 路由** | 1 文件 | **仅** `restore-htaccess-siteground.ps1`（`htaccess.restore` + PHP 触发） | — | **任何** FTPS 直传 `.htaccess` |
| **Woo 上架 / 后台配置** | — | Playwright / wp-admin（`D:\dev\独立站上架\`） | — | **任何** FTPS 当上架手段 |
| **仅 WP 首页 REST 配置** | 0 文件 | 无需上传；REST 即时生效 | — | 误触发 build + 全量部署 |

**mu-plugin 上传后 curl 快验（硬性）：** 用户或 Agent 通过 SiteGround File Manager 上传/解压新 mu-plugin 包后，下一步必须先用 `curl.exe` 带 cache-bust 直连对应 REST 端点确认新字段已生效，再继续 Sync、构建或前台回归。产品详情覆盖用正确路径：

```powershell
$t=[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
curl.exe -sS "https://carp-ybb.com/wp-json/ybb/v1/site-manager/product-live/<handle>?_=$t"
```

示例：`tz-el-074` 必须看 `titles.zh` / `titles.ja`、`content.description.html.*`、`purchaseSlogan.text.*`、`gallery.images` 是否为新值。不要误用 `/wp-json/ybb/v1/product-live/<sku>`（会 404），也不要用无 query 的 REST URL（SiteGround 可能缓存旧 JSON）。

#### 大文件（≥ 5 MB 或整站 `out/`）

1. **永远不要**用 FTPS 把数千个 `_next/static/chunks/*` 逐个上传。
2. **全量标准路径：** `build-static.ps1` → 生成 `deploy/ybb-static-export.zip` → 浏览器上传 **仅 4 个文件**到 `public_html/`：
   - `ybb-static-export.zip`
   - `unzip-export.php`
   - `restore-htaccess.php`
   - `htaccess.restore`
3. 脚本访问 `unzip-export.php` / `restore-htaccess.php` 在**服务器端**解压与写 `.htaccess`（快、稳、可断点重来）。
4. 解压后 **删除** 临时 zip 与 PHP；**Purge Cache**；`verify-remote-deploy.py`。
5. **首页视频等大静态资源**（如 `public/videos/*.mp4`）：build 后进 `out/videos/`，浏览器 **单文件**上传到 `public_html/videos/`（或随全量 zip 一并打包）。

#### 多个小文件（增量静态 / OEM / contact / mu-plugin）

1. **Agent 先生成清单**，用户手动上传（比 Agent 自动点 FM 更快更稳）：
   - `py scripts/stage-siteground-upload.py <topic>` → `deploy/siteground-upload/`
   - 或 `py scripts/gen-deploy-oem-contact-terms.py` 等专题脚本
2. **保持路径一致**：本地 `out/pages/...` ↔ 远端 `public_html/pages/...`；chunk ↔ `public_html/_next/static/chunks/...`。
3. **同目录多文件（mu-plugin、主题）**：本地打 zip → FM 上传到父目录 → **Extract**（勿把整个 staging 文件夹当一层目录拖进去）。
4. **增量静态最少集：** 始终包含 `out/index.html` + 其中引用的**所有新** `_next/static/chunks/*`（从 HTML 注释 buildId 与 script src 解析）。

#### FTPS 使用边界（紧急备用，非默认）

| 允许 | 不允许 |
|------|--------|
| 用户明确要求且知情时的 **manifest 增量**（`deploy_ftps.py --dry-run` 先看计划） | Agent **默认**跑 FTPS |
| **单文件**上传并用 FTPS `SIZE` 校验（参考 `scripts/vpn-upload-test.py`） | 长连接连续传几百文件（易 `EOFError` → **0 字节 index**） |
| mu-plugin **紧急**（`upload-mu-plugins.py`） | FTPS 传 `.htaccess`、全量 zip、`publish-home-index.py`、`upload-critical-chunks.py` |

**FTPS 实测参考（2026-06，VPN TUN 开）：** 约 5 MB 单 zip ≈ 7–8 s（~0.6 MB/s），`SIZE` 与本地一致；**不代表**批量 chunk 安全。

#### 浏览器 / Agent 自动化边界

| 做法 | 说明 |
|------|------|
| **用户已登录 SiteGround 后手动拖文件** | **首选**；大文件、多文件均适用 |
| `node scripts/open-siteground-chrome.mjs` | 打开 FM（CDP 9224）；用户先完成登录/验证码 |
| `upload-siteground-browser.mjs --wait-manual` | Playwright 失败时退化为「列清单 + 用户传完按 Enter」 |
| Agent 全自动 FM 上传 | **不可靠**（验证码、UI 变更、慢）；仅辅助，不得宣称「已替用户传完」除非 `verify-remote-deploy` 通过 |

#### 网络（VPN / 代理）

| 方式 | 对 SiteGround 上传 |
|------|-------------------|
| **VPN 虚拟网卡（TUN）** | 可试；美国/新加坡节点；**全程勿断线**。有利于 FTPS 单文件稳定性 |
| **仅系统 HTTP 代理** | 对 **FTPS/SFTP 基本无效**；对浏览器 FM 有一定帮助 |
| 上传中频繁换节点 | **禁止**；易断连、触发验证码 |

#### 上传后必做（所有通道）

1. `py scripts/audit-deploy-package.py`（**全量 zip 上传前必跑**；有 BLOCKER 禁止上传）
2. `py scripts/verify-remote-deploy.py`（静态/chunk/buildId）；若 CLI 返回 **HTTP 202**（SG Captcha），改用**浏览器**验收（见下方「全量 zip 部署经验」）
3. 抽查关键 URL：`/`、`/collections/sinkers/`、`/products/reviews/{handle}`、`/wp-json/`、`/checkout/`（302 正常）
4. 全量或 `.htaccess`：**Purge All Cache**
5. 远程 `index.html` body **> 50KB**；无 `ybb-*-hydrate` script

#### 全量 zip 部署经验（2026-06 — 评论功能 489 SKU 铺开）

**背景：** 单 SKU 试点（`tz-eldz-012`）通过后，全站需同步 `products/**`（1956 HTML）+ 新 `_next/static/chunks/*`（~31 个）。`deploy_ftps_reviews_patch.py` 计划 **1987 文件** FTPS 队列 — **禁止**；改用全量 zip。

| 项 | 实测数据 |
|----|----------|
| `out/` 文件数 | 2192 |
| `ybb-static-export.zip` | ~29 MB |
| PDP + reviews 页 | 489 + 489 |
| 解压结果 | `extracted 2192 files` |
| buildId（示例） | `VCDA_CZwlou80RweCQoXo` |

**上传前（硬性 — 防解压后整站崩溃）：**

```powershell
Set-Location "D:\开发\fishAgent\总包\skill\reverse-skill\omc-replica\ybb-site"
powershell -ExecutionPolicy Bypass -File scripts\build-static.ps1 -SkipSync -SkipDeploy
py scripts\audit-deploy-package.py   # 必须 OK / PASS WITH WARNINGS 且无 BLOCKER
```

审计脚本检查：zip 完整性、`out/` 与 zip 1:1、无 `wp-content`/`index.php`/`.htaccess` 误入包、全 HTML chunk 引用存在、489 评论页齐全、`htaccess.restore` 含 `products/reviews` 规则。

**标准全量流程（推荐）：**

```powershell
# 1) build + zip（若 out/ 已是最新 build 可 -SkipDeploy 只打 zip）
powershell -ExecutionPolicy Bypass -File scripts\build-static.ps1 -SkipSync -SkipDeploy

# 2) 浏览器 File Manager 上传 4 个文件到 public_html（首选）
node scripts/open-siteground-chrome.mjs
powershell -ExecutionPolicy Bypass -File scripts\deploy-siteground-browser.ps1 -SkipBuild

# 3) 验收 + 收尾
py scripts\verify-remote-deploy.py
# Purge Cache；删 public_html 下 ybb-static-export.zip、unzip-export.php、restore-htaccess.php、htaccess.restore
```

**混合通道（2026-06 实测可行 — Agent 自动化备用）：**

| 步骤 | 通道 | 说明 |
|------|------|------|
| 上传 4 部署物 | FTPS 单文件短连接 | `siteground_deploy.upload_files_ftps`；~29 MB zip ≈ 25–30 s |
| 触发 `unzip-export.php` | **浏览器** | CLI/curl 常遇 **SG Captcha HTTP 202**，解压不会执行 |
| 触发 `restore-htaccess.php` | **浏览器** | 同上；必须解压后执行，否则 clean URL / reviews 路由异常 |
| 删临时 zip/php | FTPS `delete` 或 FM | 4 个文件：`ybb-static-export.zip`、`unzip-export.php`、`restore-htaccess.php`、`htaccess.restore` |
| 更新 manifest | 本地 | `save_manifest(collect_local_files())` 或全量脚本成功后自动写 |

**禁止：** zip 未传完就访问 `unzip-export.php`（会得到残缺静态文件）。

**SG Captcha 与验收：**

- `urllib`/PowerShell/`verify-remote-deploy.py` 从服务器外访问 `index.html`、`unzip-export.php` 可能 **HTTP 202**，**不代表**站点坏了。
- 以浏览器（或已过关 Captcha 的会话）验证：首页注释 buildId 与本地一致；`/products/reviews/{handle}` 200；chunk URL 200。
- 部署后 **必 Purge Cache**，否则 `/` 与 `/index.html` 可能 split-cache 不同 buildId。

**评论功能与 zip 的关系：**

- mu-plugin（`ybb-product-reviews.php`）+ `ybb-product-reviews-embed.php`：**不在 zip 内**，单独上传，改 PHP 无需 rebuild。
- 静态评论 UI / 489 评论页：**必须在 zip 内**，全量解压一次覆盖。

**脚本索引：**

| 脚本 | 用途 |
|------|------|
| `scripts/audit-deploy-package.py` | 上传前包审计 |
| `scripts/deploy-siteground-browser.ps1` | 全量浏览器部署入口 |
| `scripts/deploy_ftps_reviews_patch.py` | 批量 FTPS（**仅** manifest 增量备用；全站评论铺开勿用） |
| `scripts/deploy_ftps_single_product.py` | 单 SKU 试错 |

---

### 增量发布标准方法（固定命令）

**默认：SiteGround File Manager 浏览器**（见 `docs/siteground-browser-deploy.md` →「增量上传」；选型见上一节「文件上传选型」）。

```powershell
Set-Location "D:\开发\fishAgent\总包\skill\reverse-skill\omc-replica\ybb-site"

# 1) build 后从 out/index.html 列出需上传的 chunk（或跑 verify 看 404）
npm run build

# 2) 打开 File Manager，进入 public_html
node scripts/open-siteground-chrome.mjs

# 3) 上传 index.html + 变更的 _next/static/chunks/*（可 --wait-manual）
node scripts/upload-siteground-browser.mjs --files out/index.html out/_next/static/chunks/<hash>.js --wait-manual

# 4) 验收（必做）
py scripts/verify-remote-deploy.py
```

**FTPS 增量（仅紧急备用，用户知情时）：**

```powershell
py scripts/deploy_ftps.py --dry-run
py scripts/deploy_ftps.py
```

`.htaccess` 仅规则更新时，走 `restore-htaccess-siteground.ps1`；完成后必须验证 `/collections/*` 与 `/products/*` 返回 200，且 `/wp-json/`、`/checkout/` 可用。

### 部署工具索引

| 脚本 | 作用 |
|------|------|
| `scripts/sync-from-wp.mjs` | build 前从 WC Store API + WP pages 拉取 → `products.json`（含 `reviewCount` / `averageRating`）/ `policy-pages.json` / `pages.json` |
| `scripts/build-static.ps1` | `sync-from-wp` → `npm run build` → zip → 默认 `deploy-siteground-browser`（`-SkipSync` / `-SkipDeploy` 可跳过） |
| `scripts/audit-deploy-package.py` | **全量 zip 上传前**包完整性审计（chunk/HTML/WP 路径/buildId） |
| `scripts/deploy-siteground-browser.ps1` | **默认**全量浏览器部署（File Manager + unzip + htaccess restore） |
| `scripts/restore-htaccess-siteground.ps1` | 仅修复 `.htaccess` / clean URL 路由 |
| `scripts/open-siteground-chrome.mjs` | 打开 SiteGround File Manager（Chrome CDP 9224） |
| `scripts/upload-siteground-browser.mjs` | Playwright 辅助上传（可 `--wait-manual`） |
| `scripts/verify-remote-deploy.py` | **部署后验收**：buildId + index 引用的 assets 全 200 |
| `scripts/deploy-zip.ps1` | 已废弃，转发到 `deploy-siteground-browser.ps1` |
| `scripts/deploy_zip.py` | 已废弃，转发到 `siteground_deploy_cli.py` |
| `scripts/deploy_ftps.py` | manifest 增量 FTPS（**紧急备用**，非默认） |
| `scripts/deploy_ftps_single_product.py` | **单 SKU 试错 FTPS**：`--handle` + 依赖 chunks（**批量前必用**） |
| `scripts/deploy_ftps_reviews_patch.py` | 评论功能 **批量** FTPS（**仅单 SKU 验收通过后**） |
| `scripts/upload-mu-plugins.py` | mu-plugin FTPS（**紧急备用**；默认用浏览器上传到 `wp-content/mu-plugins/`） |
| `scripts/publish-home-index.py` | **已废弃**（FTPS 单传 index，曾 0 字节） |
| `scripts/upload-critical-chunks.py` | **已废弃**（FTPS 批量 chunk，曾中断毁站） |
| `scripts/vpn-upload-test.py` | FTPS 单文件 ~5MB 测速 + `SIZE` 校验（诊断用，非部署） |
| `scripts/stage-siteground-upload.py` | 生成本地 ↔ `public_html` 手动上传清单到 `deploy/siteground-upload/` |
| `scripts/upload-patch-home-hydrate.py` | **已废弃**（hydrate 注入） |
| `deploy/restore-htaccess.php` | 服务器端写回 `.htaccess`（配合 `htaccess.restore`） |
| `docs/siteground-browser-deploy.md` | 浏览器部署完整说明 |
| `scripts/deploy_upload.py` | manifest / htaccess 合并共享逻辑 |
| `deploy/upload-manifest.json` | 上次成功部署的文件 size 基线（zip 成功后自动生成） |
| `deploy/unzip-export.php` | 服务器端一次性解压 zip |

### 场景速查

完整选型见上一节 **「SiteGround 文件上传选型」**。

| 场景 | 命令 |
|------|------|
| 全量 / buildId 变了 | `deploy-siteground-browser.ps1`（zip + 服务器解压，勿 FTPS 扫 `out/`） |
| clean URL / checkout 404 | `restore-htaccess-siteground.ps1` |
| 改组件后小增量（manifest 在） | 浏览器上传 `out/index.html` + 变更 chunks → `verify-remote-deploy.py` |
| **改 PDP/评论等通用组件（试错）** | `deploy_ftps_single_product.py --handle <试点>` → 验收 → 再批量 |
| 评论功能全站铺开 | 单 SKU 通过后 → **全量 zip**（`audit-deploy-package.py` → `deploy-siteground-browser.ps1`）；见 AGENTS「全量 zip 部署经验」 |
| 多文件同目录（mu-plugin / 主题） | zip + FM Extract；或 `stage-siteground-upload.py` 清单手动传 |
| 单个大文件（视频等） | 浏览器单文件；紧急可 FTPS 单文件 + `SIZE` 校验 |
| 仅 mu-plugin / 后台 REST | 浏览器 → `wp-content/mu-plugins/`（**无需 build**） |
| WC 类目与 Excel 对齐 | 下方「类目与 WooCommerce」流程 B |

---

## 类目与 WooCommerce 同步工具（本地）

**触发场景：** Excel 类目表变更、前端导航/集合页与 WP 后台类目不一致、新产品 SKU 需归入 `product_cat`、或需审计 WC 现有分类/属性。

**数据源（默认）：** `Desktop\2026泰州欧鲤钓类目表_白底净化.xlsx`（可用脚本第一个参数覆盖路径）

**类目语义（硬性）：**

| Excel 层级 | 含义 | 写入位置 |
|------------|------|----------|
| Sheet 名 | 一级类目（前 8 个主类目 + Other 下 4 子 Sheet） | `product_cat` 父级 / 前端 `collections` |
| 列 A 非空 | **大类型**（如 DG、小桃心） | `product_cat` 子级 / `productTypes` |
| 列 A 空 + 列 C | **规格/SKU 变体**（如 56g） | **不**作为导航类目；走 `pa_*` 属性 |

**WP 同步边界：**

- **替换：** `product_cat`（旧 WoodMart 英文类目由 `removeLegacySlugs` 清理）
- **保留：** `product_brand`、`product_tag`、全部 `pa_*` 全局属性

### 工具索引与使用场景

| 工具 | 何时用 | 产出 / 作用 |
|------|--------|-------------|
| `scripts/import-taizhou-categories.py` | 仅改 **前端** 导航/集合路由 | `lib/data/catalog-taxonomy.json` |
| `scripts/build-wc-category-map.py` | 需让 **WP `product_cat`** 与 Excel 对齐 | `lib/data/wc-category-sync.json` |
| `deploy/sync-wc-categories.php` | 将 JSON **应用到生产** WooCommerce | 创建/更新类目、按 SKU 重挂产品 |
| `deploy/wc-taxonomy-audit.php` | 同步前/后 **验收**（类目、品牌、标签、属性） | JSON 审计报告 |
| `deploy/wc-sku-prefixes.php` | 排查未匹配 SKU、补充 `skuPrefixFallback` | 各 `TZ-XX` 前缀计数 |
| `deploy/wc-cleanup-migration.php` | 同步完成后 **清理** 服务器临时文件 | 删除 PHP + JSON |

### 产品导入（表单为唯一源头）

**数据源（默认）：** `%USERPROFILE%\Desktop\产品表单.xlsx`

**新上架 Excel 固化规则（硬性）：** 运营侧新增/批量上架产品，默认使用
`deploy/product-import/templates/carp-ybb_product-listing-template-universal.xlsx`，字段填写规则见
`docs/product-listing-universal-template-guide.md`。模板必须保持 **单工作表 `产品上架` 横向排开**；
表头用中文展示，括号保留稳定字段 key；
不得拆成多个工作区。表内字段不得临时加列或改名；如需新增字段，必须先更新
`scripts/generate-product-listing-template.py`、导入/校验脚本与 runbook，再收运营表。
运营交付必须在同一行同时覆盖 Woo 基础字段、变体字段、图片字段、YBB 三语/展示覆盖字段；
禁止“先只上 Woo 结构，后补三语/图片”的流程。

**解析 → Woo 重导 → 前端同步：**

```powershell
Set-Location "D:\开发\fishAgent\总包\skill\reverse-skill\omc-replica\ybb-site"
py scripts/parse-product-form.py
# 或：py scripts/parse-product-form.py --xlsx "C:\Users\Administrator\Desktop\产品表单.xlsx"
```

产出目录 [`deploy/product-import/`](deploy/product-import/)：

| 文件 | 用途 |
|------|------|
| `manifest.json` | 类目 terms、统计、attribute |
| `woocommerce-products.csv` | 每 `variantSku` 一条 **simple** 可售行 |
| `sku-mappings/carp-hooks.json` | 欧鲤鱼钩 SKU 固化 |
| `sku-mappings/2026-new-products.json` | 2026新品 SKU 固化 |

上传 `product-import/` + PHP 到 `public_html` 后：

```powershell
curl.exe -sS "https://carp-ybb.com/wc-cleanup-products.php?key=ybb-migrate-20260624&dry_run=1&nocache=1"
curl.exe -sS "https://carp-ybb.com/sync-wc-products.php?key=ybb-migrate-20260624&dry_run=1&nocache=1"
curl.exe -sS "https://carp-ybb.com/wc-cleanup-products.php?key=ybb-migrate-20260624&nocache=1"
curl.exe -sS "https://carp-ybb.com/sync-wc-products.php?key=ybb-migrate-20260624&nocache=1"
```

Woo 稳定后同步前端并部署（购物车经 WC Store API 加购 → `/checkout/`，订单行 SKU = `variantSku`）：

```powershell
node scripts/sync-from-wp.mjs --site https://carp-ybb.com
powershell -ExecutionPolicy Bypass -File scripts/build-static.ps1
powershell -ExecutionPolicy Bypass -File scripts/deploy-siteground-browser.ps1 -SkipBuild
```

| 脚本 | 作用 |
|------|------|
| `scripts/parse-product-form.py` | 表单 → manifest + CSV + SKU 映射 |
| `scripts/form_parser.py` | 解析核心 |
| `scripts/wc_product_import.py` | 兼容旧 CLI（额外写 `wc-product-import.json`） |
| `deploy/sync-wc-products.php` | 按 SKU upsert simple 产品 |
| `deploy/wc-cleanup-products.php` | 清场 `TZ-*` 产品 |
| `lib/woocommerce/store-api.ts` | 静态车 → Woo 结账 |

---

### 标准工作流

**A. 仅前端类目（不动 WP）**

```powershell
Set-Location "D:\开发\fishAgent\总包\skill\reverse-skill\omc-replica\ybb-site"
py scripts/import-taizhou-categories.py
# 可选：py scripts/import-taizhou-categories.py "D:\path\to\类目表.xlsx"
npm run build
powershell -ExecutionPolicy Bypass -File scripts/restart-dev.ps1
```

**B. 前端 + WordPress 类目对齐**

```powershell
Set-Location "D:\开发\fishAgent\总包\skill\reverse-skill\omc-replica\ybb-site"
py scripts/import-taizhou-categories.py
py scripts/build-wc-category-map.py
```

上传并执行（凭证见 `secrets.local.json`，**禁止写入 AGENTS.md**）：

```powershell
py -c "from pathlib import Path; from scripts.deploy_ftps import load_secrets, upload_file; f=load_secrets()['ftp']; r=f['remoteRoot']; upload_file(f,r,Path('lib/data/wc-category-sync.json'),'wc-category-sync.json'); upload_file(f,r,Path('deploy/sync-wc-categories.php'),'sync-wc-categories.php')"
curl.exe -sS "https://carp-ybb.com/sync-wc-categories.php?key=ybb-migrate-20260624&dry_run=1&nocache=1"
curl.exe -sS "https://carp-ybb.com/sync-wc-categories.php?key=ybb-migrate-20260624&nocache=1"
```

**C. 同步后清理（必做）**

```powershell
py -c "from pathlib import Path; from scripts.deploy_ftps import load_secrets, upload_file; f=load_secrets()['ftp']; upload_file(f,f['remoteRoot'],Path('deploy/wc-cleanup-migration.php'),'wc-cleanup-migration.php')"
curl.exe -sS "https://carp-ybb.com/wc-cleanup-migration.php?key=ybb-migrate-20260624&nocache=1"
```

### Agent 规则（类目任务）

1. **先 Excel 再代码**：类目结构以 Excel 为准；改导航先跑 `import-taizhou-categories.py`，改 WP 再跑 `build-wc-category-map.py`。
2. **先 `dry_run=1` 再 apply**：确认 `productsUnmatched` 为 0 或已知例外后再正式执行。
3. **URL 必须带 `nocache=1`**：SiteGround 会缓存无 query 的 PHP 响应，否则可能读到旧结果。
4. **同步后必清理**：`wc-category-sync.json` 与 `sync-wc-categories.php` 不得长期留在 `public_html`。
5. **未匹配 SKU**：用 `wc-sku-prefixes.php` 查前缀，在 `build-wc-category-map.py` 的 `skuPrefixFallback` 或 Excel 货号列补全后重建 JSON。
6. **禁止** 为规格变体（列 A 空）新建 `product_cat`；规格走 WooCommerce 属性 `pa_*`。

---
## 产品上传 Guardrails（固定流程）

目标：产品上传必须同时覆盖三语与图片，不允许“只上结构、漏语言/漏图”。

### 固定流水（增量优先）

```powershell
Set-Location "D:\开发\fishAgent\总包\skill\reverse-skill\omc-replica\ybb-site"

# 1) 解析产品表（生成 wc-catalog / manifest / redirects）
py scripts\parse-product-form.py

# 2) 导出产品图（按 assets-manifest.csv）
node scripts\export-product-images.mjs --all

# 3) 审计图片闭环（missing-local / missing-export / missing-wp-binding）
node scripts\audit-product-images.mjs

# 4) 导入 WooCommerce（先 dry-run，再正式）
curl.exe -sS "https://carp-ybb.com/sync-wc-products.php?key=ybb-sync-2026&dry_run=1&source=product-import/wc-catalog.json&manifest=product-import/manifest.json"
curl.exe -sS "https://carp-ybb.com/sync-wc-products.php?key=ybb-sync-2026&source=product-import/wc-catalog.json&manifest=product-import/manifest.json"

# 5) 同步前端 products.json（三语输出 + 缺失告警清单）
node scripts\sync-from-wp.mjs

# 6) 构建
npm run build

# 7) 部署：默认浏览器全量或增量（见 docs/siteground-browser-deploy.md）
powershell -ExecutionPolicy Bypass -File scripts\deploy-siteground-browser.ps1 -SkipBuild
py scripts\verify-remote-deploy.py
```

### 升级为全量部署（仅以下场景）

1. `deploy/upload-manifest.json` 缺失；
2. buildId 已变化且增量清单异常（例如大量误判删除）；
3. 用户明确要求全量。

命令：

```powershell
powershell -ExecutionPolicy Bypass -File scripts\deploy-siteground-browser.ps1 -SkipBuild
py scripts\verify-remote-deploy.py
```

### 强制验收

1. 前端 EN/ZH/JA 切换后，同一商品标题跟随语言变化（非固定中文）；
2. `deploy/product-import/translation-warnings.json` 可追踪语言回退；
3. `deploy/product-import/image-audit-report.json` 三类缺口可追踪；
4. 类目页、PDP、加购支付链路抽样验证通过后，才可报“完成”。

---
## 相关文档索引

| 文件 | 用途 |
|------|------|
| `../REPLICA_PROMPT.md` | 全站规格与 design tokens |
| `../BENCHMARK_GAP_MATRIX.md` | 单一验收真相源 |
| `../INTERACTIONS_AUDIT.md` | 按钮/链接/mega hover 实测 |
| `MEGA_MENU_AUDIT.md` | Mega menu crawl |
| `HERO_CAROUSEL_AUDIT.md` | Hero slideshow crawl |
| `ANNOUNCEMENT_BAR_AUDIT.md` | Topbar marquee |
| `HEADER_SCROLL_AUDIT.md` | Sticky / hide on scroll |
| `FOOTER_AUDIT.md` | Footer 布局与动效 |
| `HOME_BOTTOM_AUDIT.md` | Stories / trust bar / recently viewed |
| `lib/data/catalog-taxonomy.json` | 前端导航/集合类目（`import-taizhou-categories.py`） |
| `lib/data/wc-category-sync.json` | WP 类目同步载荷（`build-wc-category-map.py`） |

---

## 代码修改原则

1. **最小改动**：只改与当前组件 gap 相关的文件
2. **不提交敏感信息**：API key、本地 `.env` 仅本地使用
3. **PowerShell**：旧版不支持 `&&`，用 `;` 或分行执行
