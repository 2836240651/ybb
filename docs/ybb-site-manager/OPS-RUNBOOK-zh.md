# YBB Site Manager — 运营手册

## 入口

WordPress 后台 → **YBB 站点管理**（左侧菜单）

## 无需等待部署（保存即生效）

| Tab | 可改内容 |
|-----|----------|
| 导航 | 顶部菜单顺序、链接、三语文案、OEM 子菜单 |
| 公告 | 顶部滚动公告文案（中/英/日）、链接 |
| Hero | 轮播图、链接、标题三语 |
| 首页模块 | Hot Products、Latest Stories 开关与列表 |
| 博客 | 文章列表、单篇编辑、内容块、首页轮播勾选 |
| 视频 | 工厂宣传视频 URL、标题文案 |
| 品牌 | 站点名称、副标题三语 |

保存后刷新 https://carp-ybb.com （硬刷新）即可看到变化。

## 产品运营（Product Ops）

| 操作 | 入口 | 生效时间 |
|------|------|----------|
| 改价格 / 库存 / SKU | WooCommerce → 产品 | **即时**（前台 PDP/列表拉 Woo Store API） |
| 改中文/日文标题 | YBB 站点管理 → **产品** | **即时**（覆盖 REST，无需重部署） |
| 改 PDP **英文** Description | WooCommerce → 产品 → **Description** | **即时**（`product-live` REST，无需重部署） |
| 改 PDP **中文/日文** Description | YBB 站点管理 → **产品** → 中文/日文描述列 | **即时**；留空则回退 Woo 英文 HTML |
| 改 PDP 图库顺序/首图（SKU 级） | YBB 站点管理 → **产品** | **即时**（`product-live` gallery） |
| 前台暂时隐藏 | 产品 Tab →「前台隐藏」 | **即时**（列表/轮播过滤） |
| 上新 / 改变体 / 改父 SKU | Woo 发布后触发部署 | 自动 runner **≤60 分钟**；或「部署状态」手动同步 |
| 检查静态是否跟上 | 产品 Tab →「静态站」列 | `待部署` = 已 publish 但上次静态包无此 handle |

### 可变产品变体改价（Woo 后台）

**说明：** 产品类型为 **Variable product** 时，**General** 里的 Regular price 会隐藏（Woo 正常行为）；价格在 **Variations** 里按变体填写。折叠列表只显示属性（如 Weight）和 `Edit`，**不会**在列表行直接显示价格框——需展开变体或使用批量操作。

| 界面位置 | 是否显示价格 |
|----------|--------------|
| General → Regular price | 隐藏（可变产品） |
| Variations 折叠行 | 不显示（仅属性 + Edit） |
| 展开变体 / 点 Edit | **Regular price**、**Sale price** |
| Bulk actions | **Set regular prices** 等 |

**方式 A — 逐个改价（少量 SKU）**

1. WooCommerce → **产品** → 编辑目标商品。
2. **Product data** 左上角确认为 **Variable product**。
3. 左侧点 **Variations**。
4. 点某一变体右侧 **Edit**，或点列表上方/下方 **Expand** 展开全部变体。
5. 在展开区域填写 **Regular price**（及可选 **Sale price**）。
6. 点 **Save changes**（变体区或页面底部）。

**方式 B — 批量同价**

1. Variations 顶部 **Bulk actions** → **Set regular prices**。
2. 输入价格 → **Go** → **Save changes**。

**改价后验收（无需 rebuild / deploy）**

1. 保存 Woo 变体价格。
2. 打开前台对应 PDP，**硬刷新**（Ctrl+F5）。
3. 可选：浏览器访问  
   `https://carp-ybb.com/index.php?rest_route=/wc/store/v1/products/{变体ID}`  
   确认 JSON 里 `prices.price` 已更新。

**注意**

- **YBB 站点管理 → 产品** Tab **不能**改价（设计如此；价格真源为 Woo）。
- **只改价格 / 库存** 不触发静态站部署；**新增变体 / 改父 SKU / 新上架** 才需 runner 同步。
- 若展开变体后仍看不到价格框，联系开发跑诊断：  
  `py scripts/inspect-wp-product-price.py <父产品 post ID>`

### 部署流水线（runner）

**推荐：一台固定 Ubuntu 部署机常驻轮询**（运营电脑无需装脚本）。详见 `docs/ybb-site-manager/DEPLOY-MACHINE-ubuntu.md`。

**硬性边界：**「部署状态 / 立即同步」只触发 Ubuntu 部署机从 Woo/WP 拉数据、构建并部署静态站；它不读取开发电脑上的本地代码。若开发本地改了前端代码、样式或构建逻辑，必须先把代码同步到 Ubuntu 部署机 `/opt/ybb-site`，再由部署机部署。不要一边本地手动上传 SiteGround，一边让后台 Sync/runner 并行跑，否则后完成的一方会覆盖前一方。

**开发同步硬规则：** 开发把本地代码推到 Ubuntu 部署机时，必须走完整源码同步清单，不能只推本次 diff。部署机目录可能缺少本地已有但未改动的源码文件；diff-only 会导致 build 缺模块。同步后必须先由开发在部署机执行 `npm run build` 验证通过，再让「立即同步」或 runner 上线。

本地或计划任务执行：

```powershell
Set-Location "D:\开发\fishAgent\总包\skill\reverse-skill\omc-replica\ybb-site"
powershell -ExecutionPolicy Bypass -File scripts\ybb-deploy-runner.ps1
# 轮询：-Poll -IntervalSec 300
```

Ubuntu 部署机：

```bash
cd /opt/ybb-site
bash scripts/ybb-deploy-runner.sh --poll --interval 300
# 安装：sudo bash scripts/setup-deploy-runner-ubuntu.sh
```

顺序：`sync-from-wp-playwright` → `fix-variation-ids-playwright` → `product-sync-acceptance`（漂移不过则中止）→ `build-static` → `deploy-siteground-browser` → `verify-remote-deploy`。

### 常见问题（产品）

**Q: 加购 400 / invalid product？**  
A: 多为变体 wcId 漂移。开发跑 `py scripts/fix-variation-ids-playwright.py` 后重新部署；runner 已自动执行。

**Q: 新产品前台 404？**  
A: 看产品 Tab 是否显示「待部署」；到「部署状态」点立即同步，success 后 Purge 缓存。

**Q: 改了中文标题没变？**  
A: 在 **产品** Tab 保存覆盖（不是 Woo 标题）；硬刷新前台。

**Q: PDP 仍显示 Woo 原图顺序？**  
A: 在 **产品** Tab 填「覆盖图库 URL（每行一个）」后保存；若留空则默认跟 Woo 图顺序。

**Q: Variations 里只有 Weight 下拉，没有改价的地方？**  
A: 折叠列表不显示价格。点 **Edit** 或 **Expand** 展开变体后可见 **Regular price**；或用 **Bulk actions → Set regular prices**。详见上文「可变产品变体改价」。

**Q: 改了 Woo 价格前台没变？**  
A: 硬刷新 PDP；确认改的是**变体**价格而非父产品 General（可变产品 General 无价框）。仍不对时用 Store API URL 核对变体 `prices.price`。

**Q: 改了 Woo Description 前台没变（或中/日文没变）？**  
A: **英文**走 Woo Description，硬刷新后应即时更新。若切到**中文/日文**仍显示旧文案，说明站点管理里 `descriptionZh/Ja` 有覆盖——须在 **产品** Tab 更新或清空中/日文描述列；Woo 改英文**不会**自动更新中/日文。

**Q: 中文/日文 Description 排版叠在一起？**  
A: 多为站点管理里存了纯文本。mu-plugin ≥1.8.4 会自动 `wpautop` 分段；保存一次产品 Tab 或硬刷新 PDP 后应恢复段落间距。

### PDP 图库（主图上方 + 底部缩略图）配置说明

产品 Tab 每个 SKU 新增 4 个字段：

| 字段 | 作用 | 建议 |
|------|------|------|
| 图库启用 | 控制该 SKU 是否启用底部缩略图交互 | 默认开启 |
| 默认图 | 进入 PDP 初始显示的图片索引（从 0 开始） | 通常设 `0` |
| 覆盖图库 URL | 每行一个图片 URL；填写后优先于 Woo 图列表 | 仅在需自定义排序/替换图时填写 |
| 隐藏序号 | 按索引隐藏图片（逗号分隔，如 `2,3`） | 对 Woo 图或覆盖图都生效 |

优先级：**Woo 图集为基准**；仅当「覆盖图库 URL」非空时，Site Manager 才强覆盖 Woo。

### PDP Description（商品描述 Tab）

前台 PDP 的 **Description** 内容来自 `product-live` REST，**不** bake 进静态 `products.json`。

| 语言 | 写入入口 | 前台读取 |
|------|----------|----------|
| **英文** | WooCommerce → 产品 → **Description**（可视化/文本编辑器） | `content.description.html.en` |
| **中文** | YBB 站点管理 → **产品** → **中文描述** | `content.description.html.zh`；**留空**则用英文 HTML |
| **日文** | YBB 站点管理 → **产品** → **日文描述** | `content.description.html.ja`；**留空**则用英文 HTML |

**运营注意：**

1. 在 Woo 改英文描述后，**中文/日文不会自动同步**——若站点管理里已填过中/日文覆盖，须在同一 Tab 手动更新，或清空覆盖以临时显示英文版式。
2. 中/日文描述支持 HTML；纯文本（仅换行）保存时会**自动分段**为 `<p>` 段落。
3. 改 Woo 英文或站点管理中/日文后，前台 PDP **硬刷新**（Ctrl+F5）即可；无需 rebuild 静态站。

**Woo Description 编辑器（英文）：**

| 操作 | 效果 |
|------|------|
| **Enter** | 新段落（段与段之间空一行） |
| **Shift+Enter** | 段内换行（`<br>`） |
| 工具栏 **Format** | 标题 H2/H3 等 |
| 工具栏 **分隔线** | 水平线 `<hr>` |
| 工具栏 **列表** | 项目符号 / 编号列表 |

若从 Word/记事本粘贴纯文本且只有单次换行，前台 REST 会将**每一行**转为独立段落（mu-plugin ≥1.8.5）。若已有 `<p>` 但段内含手动换行，会自动转为 `<br>`。

**验收 URL（开发/运营自检）：**

`https://carp-ybb.com/wp-json/ybb/v1/site-manager/product-live/{handle}`

检查 `content.description.html.en/zh/ja` 是否含 `<p>` 等块级标签。

## 需要等待自动部署（Phase 3）

| 操作 | 说明 |
|------|------|
| Woo 发布/更新产品 | 约 5–60 分钟自动同步静态站；在「部署状态」Tab 查看进度 |
| 手动点「立即同步站点」 | 管理员触发全量 rebuild（产品多时较慢） |

## 产品上架

仍在 **WooCommerce → 产品** 操作（或使用独立站上架 Playwright 流程）。Site Manager 不负责创建 SKU。

## 常见问题

**Q: 改了导航前台没变？**  
A: 强制刷新；若仍旧内容，请开发 Purge SiteGround 缓存。

**Q: Hot Products 填了 slug 不显示？**  
A: 先确认 **首页模块 → Hot Products「显示」** 已勾选；再确认 Woo 已发布且 slug 与 `/products/{slug}` 一致。

**Q: 最近更新 / Latest Stories 后台关了仍显示？**  
A: 2026-07 起总开关仅在 **首页模块 → Latest Stories「显示」**；博客 Tab 只管理文章与「首页轮播」勾选。保存首页模块后 REST `/ybb/v1/latest-stories` 应返回 `enabled:false`。

**Q: 博客改完前台没变？**  
A: 在 **博客 → 编辑** 保存后，对文章页 **硬刷新**（Ctrl+F5）。已有 handle **无需 redeploy**。用编辑页「预览前台」链接验收。

**Q: 新博客文章 URL 404？**  
A: 新 handle 需技术执行 `build-static.ps1` 部署后才有静态 HTML 路由；改已有文章内容不需要。

**Q: 新产品 404？**  
A: 等「部署状态」显示 success，或联系开发检查 deploy runner。
