# YBB Site Manager — 开发手册

## 路径

| 项 | 路径 |
|----|------|
| 插件 | `deploy/wp-content/mu-plugins/ybb-site-manager/` |
| 前台 API | `lib/ybb-rest.ts`, `lib/site-manager/` |
| Hook | `hooks/useYbbConfig.ts` |
| 文档 | `docs/ybb-site-manager/` |

## 上传 mu-plugin（默认）

```powershell
Set-Location "D:\开发\fishAgent\总包\skill\reverse-skill\omc-replica\ybb-site"
py scripts/upload-ybb-site-manager.py
```

或 SiteGround File Manager 上传整个 `ybb-site-manager/` 目录到 `wp-content/mu-plugins/`。

**仅 mu-plugin 变更：不需 `npm run build`。**

## 何时需要 build + 静态 deploy

- 修改 `components/` 中 client fetch 逻辑或布局
- 修改 `lib/site-manager/` 类型或 fetch 路径

```powershell
npm run build
powershell -ExecutionPolicy Bypass -File scripts\restart-dev.ps1
powershell -ExecutionPolicy Bypass -File scripts\build-static.ps1 -SkipSync
powershell -ExecutionPolicy Bypass -File scripts\deploy-siteground-browser.ps1 -SkipBuild
```

## 硬性禁止

- hydrate.js / MutationObserver 注入 index.html
- `HotProductsRuntime` 模式
- partial save 清空未提交模块（sanitize 必须 merge existing）

## REST 调试

```
https://carp-ybb.com/index.php?rest_route=/ybb/v1/site-manager/navigation
```

## Phase 3 Runner

```powershell
powershell -ExecutionPolicy Bypass -File scripts\ybb-deploy-runner.ps1 -Poll
```

配置 `secrets.local.json` → `deploy.runnerKey` 与 WP 选项 `deploy.secret` 一致。
