# YBB Site Manager — 后台 UX

## 菜单

**YBB 站点管理**（顶级菜单，dashicons-admin-site）

## Tab 结构

1. **导航** — primaryNav repeater + footer 链接（quickLinks / social 简表）
2. **公告** — enabled 开关 + items repeater（三语 textarea + href + 选图无）
3. **Hero** — autoplayMs + slides repeater（媒体库选图、三语标题、href）
4. **首页模块** — wholesale / hot products / latest stories（自 ybb-home-settings 迁移）
5. **视频** — videoUrl、posterUrl、三语 title/body/cta
6. **Featured** — handle 输入 + enabled
7. **品牌** — name、tagline 三语、logoPath
8. **部署状态** — state、lastBuildId、手动触发、Deploy Secret
9. **操作记录** — 配置/部署审计时间线（筛选、分页、CSV 导出）

## 操作记录 Tab（v1.1.0）

- **与「部署状态」分工**：部署状态 = 当前任务；操作记录 = 历史时间线
- 筛选：类别（配置/部署/系统）、状态、近 7/30/90 天
- 每条含：时间、操作人、模块、状态图标、摘要、可展开详情、下一步提示
- 配置保存后自动 REST 探测并写入验证结果
- 导出 CSV（UTF-8 BOM，Excel 可开中文）

## 字段约定

- 所有运营可见文案：**labels.en / labels.zh / labels.ja**
- 链接：站内 `/path` 或 `https://`
- 图片：媒体库按钮 + 文本 URL
- Checkbox「显示」= `enabled`

## 恢复默认

各 Tab 底部「恢复默认」仅重置该 Tab 模块，不影响其他 Tab。
