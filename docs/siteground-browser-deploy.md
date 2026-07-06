# SiteGround 浏览器部署（carp-ybb 静态站）

**默认路径**：静态站、mu-plugin、增量 HTML/JS **一律优先 SiteGround File Manager（浏览器）**。  
**禁止** 把 FTPS 当作默认：`deploy_ftps.py` / `publish-home-index.py` 曾 `EOFError`，导致首页 **0 字节** 或 chunk **404**。

**上传选型总表（大文件 / 多小文件 / FTPS 边界 / VPN）：** 见 [`AGENTS.md`](../AGENTS.md) →「**SiteGround 文件上传选型**」。

通过浏览器上传文件，全量时再用服务器端 PHP 触发解压与 `.htaccess` 恢复。

## 为什么不用 FTPS？

| 问题 | 后果 |
|------|------|
| SiteGround FTPS 长连接 `EOFError` | 上传中断，`index.html` 变成 0 字节 → **整站白屏** |
| 只传 index 未传新 hash chunk | 控制台 chunk 404 → React 不 hydrate |
| FTPS 直传 `.htaccess` | clean URL / checkout 路由异常 |

**可以走浏览器上传**——本项目已配套脚本，且与 Woo Playwright 共用 Chrome CDP 会话。

## 适用场景

| 场景 | 命令 |
|------|------|
| 仅修复路由 / `.htaccess` | `scripts/restore-htaccess-siteground.ps1` |
| 全量静态站上线（build 后） | `scripts/deploy-siteground-browser.ps1` |
| 构建 + 部署一条龙 | `scripts/build-static.ps1` |
| **增量**（改 1 个组件后） | 见下方「增量上传」 |
| **仅 mu-plugin**（后台 REST / 设置页） | 见下方「mu-plugin 上传」 |
| 部署验收 | `py scripts/verify-remote-deploy.py` |

## 前置

- `secrets.local.json` 含 `deploy.siteToolsSiteId`
- Chrome 已安装
- Playwright（复用 `D:\dev\独立站上架\wordpress\node_modules\playwright`）

## 标准流程（默认全自动 zip 部署）

```powershell
Set-Location "D:\开发\fishAgent\总包\skill\reverse-skill\omc-replica\ybb-site"

# 0) 上传前审计（全量 zip 必做）
powershell -ExecutionPolicy Bypass -File scripts\build-static.ps1 -SkipSync -SkipDeploy
py scripts\audit-deploy-package.py

# 1) 一条命令：FTPS 传 4 文件 → 服务器 unzip → 恢复 .htaccess（Captcha 时 Playwright 自动触发 PHP）
powershell -ExecutionPolicy Bypass -File scripts\deploy-siteground-browser.ps1 -SkipBuild

# 仅修 .htaccess（buildId 已一致时脚本会自动走 htaccess-only）
powershell -ExecutionPolicy Bypass -File scripts\restore-htaccess-siteground.ps1
```

**默认无需打开 SiteGround File Manager。** 脚本会：

1. FTPS 上传 `ybb-static-export.zip`、`unzip-export.php`、`restore-htaccess.php`、`htaccess.restore`
2. 访问 `unzip-export.php` 在服务器解压（curl 被 Captcha 拦截时自动用 headless 浏览器触发）
3. 访问 `restore-htaccess.php` 写回路由
4. 校验 buildId 与关键路由

 legacy 手动上传：加 `-ManualUpload`。SiteGround FM Playwright 上传：加 `-AutoUpload`。

### 上传前审计（`audit-deploy-package.py`）

**全量 zip 上传前必跑**，避免解压后整站白屏或 chunk 404。

```powershell
py scripts\audit-deploy-package.py
```

| 检查项 | 通过标准 |
|--------|----------|
| zip 完整性 | `testzip()` 无损坏 |
| `out/` ↔ zip | 文件数一致，无缺失 |
| 危险路径 | zip 内**无** `wp-content/`、`wp-admin/`、`index.php`、`.htaccess` |
| 目录结构 | 根即 `index.html`、`products/`、`_next/`（无 `out/` 前缀） |
| chunk 引用 | 全部 HTML 引用的 `_next/static/*` 均存在于包内 |
| 评论页 | PDP 与 `products/reviews/` 数量一致（489+489） |
| buildId | 种子页 buildId 统一 |

输出 `BLOCKED` → **禁止上传**；`OK` 或仅有 WARNING 且无 BLOCKER → 可继续。

### 全量 zip 部署经验（2026-06 评论功能全站）

**场景：** 489 SKU ×（PDP + reviews 页）+ 新 JS chunk；`deploy_ftps_reviews_patch.py` 约 1987 文件 FTPS — **勿用**。

| 指标 | 值 |
|------|-----|
| zip 大小 | ~29 MB |
| 解压文件数 | 2192 |
| 上传物 | 仅 4 个：`ybb-static-export.zip`、`unzip-export.php`、`restore-htaccess.php`、`htaccess.restore` |

**推荐顺序：**

1. `audit-deploy-package.py` → OK  
2. 上传 4 文件到 `public_html/`（浏览器 FM **首选**）  
3. 浏览器打开 `https://carp-ybb.com/unzip-export.php` → 应见 `extracted N files`  
4. 浏览器打开 `https://carp-ybb.com/restore-htaccess.php?key=ybb-migrate-20260624` → 应见 `restored .htaccess`  
5. 删 4 个临时文件；**Purge Cache**  
6. 验收 buildId + 抽查 `/products/reviews/{handle}`  

**混合自动化（Agent 备用）：** FTPS 可稳定上传 4 个部署物（单文件短连接）；但 **CLI/curl 触发 unzip/htaccess 常被 SG Captcha（HTTP 202）拦截**，必须用**浏览器**访问上述两个 PHP URL。

**`verify-remote-deploy.py`：** CLI 也可能 202；若失败，用浏览器核对 `index.html` 注释 buildId 与本地 `out/index.html` 一致，且 body > 50KB。

**zip 不会删除 WordPress：** 解压只覆盖 zip 内路径；`wp-content`、`wp-admin` 不在包内，Woo 不受影响。

**评论 PHP 不在 zip 内：** `ybb-product-reviews.php`、`ybb-product-reviews-embed.php` 单独维护；改 mu-plugin 无需 rebuild 静态站。

---

1. `deploy/ybb-static-export.zip`
2. `deploy/unzip-export.php`
3. `deploy/restore-htaccess.php`
4. `deploy/htaccess.restore`

脚本会在你确认上传完成后自动：

1. 访问 `https://carp-ybb.com/unzip-export.php` 解压静态站
2. 访问 `https://carp-ybb.com/restore-htaccess.php?key=ybb-migrate-20260624` 写回 `.htaccess`
3. 校验 `/collections/*`、`/products/*`、`/wp-json/`、`/checkout/` 路由

### 收尾（必做）

在 File Manager 删除临时文件：

- `restore-htaccess.php`
- `htaccess.restore`
- `unzip-export.php`
- `ybb-static-export.zip`

然后在 SiteGround → **Speed Optimizer → Purge Cache** 清缓存。

## 半自动上传（Playwright）

```powershell
node scripts/open-siteground-chrome.mjs
powershell -ExecutionPolicy Bypass -File scripts\deploy-siteground-browser.ps1 -SkipBuild -AutoUpload
```

若 File Manager UI 变化导致自动上传失败，脚本会提示你手动上传后按 Enter 继续。

## 增量上传（改组件 / 修 Hot Products 前端后）

**不需要** 每次改后台配置都全量 zip；但 **改了 Next 组件并 build 后** 必须上传 `index.html` 及其引用的 **新** `_next/static/chunks/*`。

```powershell
Set-Location "D:\开发\fishAgent\总包\skill\reverse-skill\omc-replica\ybb-site"

npm run build

# 打开 File Manager → 进入 public_html
node scripts/open-siteground-chrome.mjs

# 上传 index + 变更的 chunk（可多文件；UI 不支持子目录时先 cd 到对应目录再传）
node scripts/upload-siteground-browser.mjs `
  --files out/index.html out/_next/static/chunks/<新hash>.js `
  --wait-manual

# 必做验收
py scripts/verify-remote-deploy.py
```

手动方式：SiteGround 面板 → **Site Tools → File Manager → carp-ybb.com → public_html**，用界面上传覆盖同名文件。

**仅改 WP 后台配置**（YBB Home Settings 里改标题/图片/启用行）：**不用** build、**不用** 传 `index.html`；前台组件会 `fetch` REST 即时生效。

## mu-plugin 上传（后台 REST / 设置页 PHP）

目标目录：`public_html/wp-content/mu-plugins/`

```powershell
node scripts/open-siteground-chrome.mjs
# File Manager 中进入 wp-content/mu-plugins/
node scripts/upload-siteground-browser.mjs `
  --files deploy/wp-content/mu-plugins/ybb-home-settings.php `
  --wait-manual
```

可一次传多个 mu-plugin 文件。`py scripts/upload-mu-plugins.py`（FTPS）仅 FTPS 紧急备用。

## 路由验收清单

以下 URL 必须非 404：

- `https://carp-ybb.com/collections/sinkers/`
- `https://carp-ybb.com/products/tz-qz-025/`
- `https://carp-ybb.com/products/reviews/tz-eldz-012/`（评论页 clean URL）
- `https://carp-ybb.com/wp-json/`
- `https://carp-ybb.com/checkout/`（302 到 Woo 正常）
- `https://carp-ybb.com/?wc-ajax=get_refreshed_fragments`（必须返回 JSON，不能是 Next.js HTML）

## 废弃

- `deploy_zip.py` / `deploy-zip.ps1` 已转发到浏览器流程
- **禁止** 用 FTPS 直接改 `.htaccess`（易断连且曾导致 clean URL 404）
- `deploy_ftps.py` / `publish-home-index.py` / `upload-critical-chunks.py` — **紧急备用**；默认禁止 Agent 自动执行
- hydrate 注入（`patch-index-home-hydrate.php`、`ybb-*-hydrate.php` 非 no-op）— **永久禁止**（曾导致首页卡死）
