# YBB Site Manager — 后台 UX

## 菜单

**YBB 站点管理**（顶级菜单，dashicons-admin-site）

## Tab 结构

1. **导航** — primaryNav repeater + footer 链接（quickLinks / social 简表）
2. **公告** — enabled 开关 + items repeater（三语 textarea + href + 选图无）
3. **Hero** — autoplayMs + slides repeater（媒体库选图、三语标题、href）
4. **首页模块** — wholesale / hot products / latest stories（自 ybb-home-settings 迁移）
5. **博客** — 文章列表 + 单篇编辑；contentBlocks 块编辑器；保存后硬刷新前台（无需 redeploy）
6. **视频** — videoUrl、posterUrl、三语 title/body/cta
7. **Featured** — handle 输入 + enabled
8. **品牌** — name、tagline 三语、logoPath
9. **部署状态** — state、lastBuildId、手动触发、Deploy Secret
10. **操作记录** — 配置/部署审计时间线（筛选、分页、CSV 导出）

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

## 博客 Tab（v1.10.0 / BAX）

### 视图

| URL | 用途 |
|-----|------|
| `&tab=blog` | 列表：全局设置 + 文章表 + 行内「显示 / 首页轮播」 |
| `&tab=blog&article={handle}` | 单篇编辑：元数据 + contentBlocks 块编辑器 |

### 保存模式

- **列表保存**（`ybb_sm_blog_save_mode=list`）：仅更新博客顶层字段 + 表格内 toggle，不碰正文。
- **单篇保存**（`ybb_sm_blog_save_mode=article`）：merge 当前文章，**不覆盖**其他文章。

### 内容块类型

段落 · 小标题 · 引用 · 图片 · 图文 · 清单 · 行动按钮 — 按 type 显隐字段（PHP + JS）。

### 前台生效

已有 handle：**保存 → 硬刷新** 文章页 / 首页轮播，**无需 redeploy**。  
新 handle URL：需静态站 deploy。  
Latest Stories **总开关**在「首页模块」Tab。

## 恢复默认

各 Tab 底部「恢复默认」仅重置该 Tab 模块，不影响其他 Tab。
