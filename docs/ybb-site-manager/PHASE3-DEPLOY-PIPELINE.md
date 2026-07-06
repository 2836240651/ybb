# Phase 3 — 自动部署流水线

## 架构

```
Woo product publish → deploy-queue.php 入队 (debounce 5min)
       ↓
ybb-deploy-runner.ps1 轮询 GET /ybb/v1/deploy/status
       ↓
sync-from-wp.mjs → build-static.ps1 -SkipDeploy → audit-deploy-package.py
       ↓
FTPS 4 files → Playwright unzip?run={buildId} → restore-htaccess → cleanup
       ↓
PATCH deploy/status → success + buildId
```

## Runner 安装

1. 在 WP **YBB 站点管理 → 部署状态** 复制 Deploy Secret
2. 写入 `secrets.local.json`:
   ```json
   { "deploy": { "runnerKey": "your-secret-here" } }
   ```
3. Windows 任务计划每 5 分钟：
   ```powershell
   powershell -File scripts\ybb-deploy-runner.ps1 -Poll
   ```

## Captcha / 缓存

- unzip URL: `?run={buildId}&t={unix}`
- PHP 响应头: `Cache-Control: no-store`
- 成功后删除 zip + php 临时文件
- **手动 Purge Cache**（SiteGround Speed Optimizer）

## 失败处理

- `audit-deploy-package.py` BLOCKED → 不 upload，state=failed
- Runner 写 `lastError` 到 WP option
- 后台 admin notice 显示失败原因
