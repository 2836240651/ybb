# YBB Site Manager — 操作记录 PRD（生产版）

## 1. 背景

运营在「YBB 站点管理」中修改导航、公告、Hero、部署等配置后，无法确认是否成功、是否需等待部署、谁做了什么。本功能提供**运营可读**的操作时间线。

## 2. 目标

- 每次配置保存、恢复默认、部署入队/执行/完成均写入审计日志
- 后台 **操作记录** Tab：筛选、分页、详情展开、CSV 导出
- 配置保存后自动探测 REST 可达性（服务器端），并写入验证结果
- 部署 Runner 上报分步进度与最终结果

## 3. 非目标

- 不替代 SiteGround / PHP error_log
- 不记录完整 POST body 或密钥
- 不对非 `manage_options` 用户开放

## 4. 功能规格

### 4.1 记录类型

| 类别 | 触发 | 运营可见摘要 |
|------|------|----------------|
| config | 各 Tab 保存 | 「已更新公告栏 6 条，刷新前台即可」 |
| config | 恢复默认 | 「已将【导航】恢复为默认」 |
| deploy | 手动同步 / 产品发布 | 「已加入部署队列，约 5–60 分钟」 |
| deploy | debounce 合并 | 「已合并到进行中的部署任务」 |
| deploy | Runner claim | 「正在同步产品并重建静态站…」 |
| deploy | Runner 分步 | 「正在构建静态站 / 上传文件…」 |
| deploy | 成功 / 失败 | 「站点已更新 buildId xxx」/「部署失败：…」 |
| system | 插件迁移、Secret 保存 | 仅管理员可见 |

### 4.2 单条记录字段

| 字段 | 说明 |
|------|------|
| id | `log-{unix}-{rand}` |
| at | ISO8601 站点时区 |
| actor / actorId | WP 用户显示名；系统任务为「系统」 |
| category | config \| deploy \| system |
| module | navigation, announcements, … |
| moduleLabel | 中文模块名 |
| action | save, reset, deploy_queue, … |
| actionLabel | 中文动作名 |
| status | success \| failed \| running \| warning \| info |
| summary | 一行主文案（运营主阅读） |
| detail | 多行变更说明 |
| nextStep | 失败或需等待时的「下一步」 |
| meta | buildId, verifyHttp, productTitle, steps… |

### 4.3 存储

- Option：`ybb_site_manager_audit_log`（与 `ybb_site_manager_settings` 分离）
- 上限 **500** 条 FIFO；超过 **90** 天自动清理
- 不建自定义表（当前量级足够）

### 4.4 后台 UI — Tab「操作记录」

- 筛选：类别（全部/配置/部署）、状态（全部/成功/失败/进行中）、天数（7/30/90/全部）
- 表格：时间、操作人、模块、状态图标、摘要、「详情」折叠
- 分页：每页 50 条
- 按钮：导出 CSV（UTF-8 BOM）
- 不展示 Deploy Secret

### 4.5 REST

- `GET /ybb/v1/site-manager/audit-log` — 管理员 JSON（筛选参数同 UI）
- `POST /ybb/v1/deploy/step` — Runner 上报步骤（Deploy Key）

### 4.6 配置保存后 REST 探测

保存 config 模块后，插件对对应 `index.php?rest_route=...` 发起 `wp_remote_get`（15s 超时）。  
- HTTP 200 → meta.verifyStatus=ok，摘要追加「接口正常」  
- 202/403 等 → warning，摘要说明「配置已保存；若前台未变请硬刷新或 Purge 缓存」

## 5. 实施清单

| # | 项 | 文件 | 状态 |
|---|-----|------|------|
| 1 | 审计核心 + diff + 钩子 | `includes/modules/audit-log.php` | ✅ |
| 2 | 操作记录 Tab UI | `includes/admin/tab-audit.php` | ✅ |
| 3 | 注册 Tab + 样式 | `includes/admin/page.php` | ✅ |
| 4 | 保存前快照 | `includes/class-sanitize.php` | ✅ |
| 5 | 部署日志集成 | `includes/modules/deploy-queue.php` | ✅ |
| 6 | 恢复默认/手动部署日志 | `includes/migrate.php` | ✅ |
| 7 | REST audit + deploy/step | `includes/class-rest.php` | ✅ |
| 8 | Runner 分步上报 | `scripts/ybb-deploy-runner.ps1` | ✅ |
| 9 | 文档 | 本文件 + ADMIN-UX + ACCEPTANCE | ✅ |

## 6. 验收标准

- [ ] 保存公告 Tab → 操作记录出现成功项 + 变更摘要
- [ ] 仅保存公告不丢失导航（partial save）且日志只记公告
- [ ] 恢复默认 → 记录模块名 + 操作人
- [ ] 手动「立即同步」→ 部署类 running/pending 记录
- [ ] Runner complete success/failed → 对应记录 + buildId
- [ ] 筛选「仅失败」只显示 failed
- [ ] CSV 导出可在 Excel 打开中文
- [ ] 非管理员不可见 Tab / REST

## 7. 版本

- 插件版本：**1.1.0**
- 依赖：YBB Site Manager 1.0.0+
