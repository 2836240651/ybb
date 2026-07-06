# YBB Site Manager — 验收清单

## Phase 1

- [ ] `GET .../site-manager/navigation` 返回 primaryNav + footer
- [ ] wp-admin 改导航项顺序 → 刷新 carp-ybb Header 顺序变化（无 redeploy）
- [ ] 改公告三语 → AnnouncementBar 文案变化
- [ ] 改 Hero 图/标题/链接 → 轮播变化
- [ ] 只保存公告 Tab 不丢失导航数据
- [ ] 移动端 320px 无横向溢出（`audit-mobile-viewports.mjs`）

## Phase 2

- [ ] 单一菜单「YBB 站点管理」含首页/视频/品牌 Tab
- [ ] `/ybb/v1/hot-products` 仍可用
- [ ] 换 factory video URL 生效
- [ ] Featured handle 变更后首页主推变
- [ ] BrandLogo 副标题 client fetch 生效（无 sync 依赖）

## Phase 3

- [ ] 发布测试 SKU → runner → 新 PDP HTTP 200
- [ ] 连续保存 3 次产品 → 仅 1 次 deploy
- [ ] audit BLOCKED 时不覆盖生产 index.html
- [ ] 部署状态 Tab 显示 lastBuildId 与错误信息

## 操作记录（v1.1.0）

- [ ] 保存公告 Tab → 操作记录出现成功项 + 变更摘要
- [ ] 仅保存公告不丢失导航（partial save）且日志只记公告
- [ ] 恢复默认 → 记录模块名 + 操作人
- [ ] 手动「立即同步」→ 部署类 running 记录
- [ ] Runner complete success/failed → 对应记录 + buildId
- [ ] 筛选「仅失败」只显示 failed
- [ ] CSV 导出可在 Excel 打开中文
- [ ] 非管理员不可见 Tab / REST `GET .../site-manager/audit-log`

## Phase 2.5 — Product Ops Layer（POL）

- [ ] `GET .../product-overrides` 返回 overrides map
- [ ] Admin 保存 `titleZh` → REST 即时更新（无 redeploy）
- [ ] POST override 含 `price` → 400
- [ ] Woo 改价 → PDP 显示新价（无 redeploy，S2 后）
- [ ] `tz-xp-038` add-item 200（parent + variation）
- [ ] `product-ops-acceptance.py` PASS
- [ ] deploy 后 `product-sync-acceptance.py` PASS
