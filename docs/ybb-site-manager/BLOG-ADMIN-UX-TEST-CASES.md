# 博客后台运营 UX 重构 — 测试用例（BAX）

> **配套设计：** `BLOG-ADMIN-UX-DESIGN.md`  
> **配套实施包：** `BLOG-ADMIN-UX-IMPLEMENTATION-PACK.md`  
> **自动化脚本：** `scripts/test_blog_admin_ux_contract.py`（源码契约）  
> **回归脚本：** `scripts/test_blog_content_blocks_contract.py`、`scripts/test_blog_realtime_contract.py`  
> **可选 E2E：** `scripts/blog-admin-ux-acceptance.py`（待实现，Playwright）  
> **抽样文章 handle：** `2026-catalog-launch`、`oem-packaging-guide`

---

## 1. 测试范围

| 层级 | 覆盖 |
|------|------|
| Admin 路由 | 列表视图 / 单篇编辑视图 URL |
| Admin UI | 搜索筛选、type 显隐、块增删排序、缩略图、中文文案 |
| Sanitizer | 列表 partial 保存、单篇 merge、不丢其他文章 |
| REST | `/ybb/v1/site-manager/blog`、`/ybb/v1/latest-stories` 形状不变 |
| 前台实时 | 已有文章改标题/块后硬刷新可见，**无 redeploy** |
| 回归 | contentBlocks 渲染、Latest Stories 委托、audit-log |
| 非功能 | `max_input_vars` 安全、无 JS 降级 |

---

## 2. 测试环境与前置

### 2.1 环境

| 环境 | URL |
|------|-----|
| 生产 WP Admin | `https://carp-ybb.com/wp-admin/admin.php?page=ybb-site-manager&tab=blog` |
| 生产前台 | `https://carp-ybb.com/blogs/news/` |
| 本地（可选） | `http://localhost:3000/blogs/news/` + 本地 WP |

### 2.2 前置条件

- [ ] mu-plugin **≥ 1.10.0** 已上传（`YBB_SM_VERSION`）
- [ ] 测试账号具备 `manage_options`
- [ ] 博客默认 **10 篇** 文章数据存在
- [ ] 首页模块 **Latest Stories 显示** 已开启（测轮播用）
- [ ] 浏览器可硬刷新；curl 带 `?_=` cache-bust

### 2.3 测试数据

| 键 | 值 |
|----|-----|
| `BLOG_HANDLE` | `news` |
| `ARTICLE_A` | `2026-catalog-launch` |
| `ARTICLE_B` | `oem-packaging-guide` |
| `TITLE_A_ORIG` | （保存前从 REST 读取） |
| `TITLE_A_TEST` | `TEST-BAX Title {timestamp}` |
| `BLOCK_TEXT_TEST` | `TEST-BAX paragraph body {timestamp}` |

---

## 3. 源码契约测试（自动化）

### TC-CONTRACT-01 — tab-blog 模块存在

| 项 | 内容 |
|----|------|
| **脚本** | `py scripts/test_blog_admin_ux_contract.py` |
| **断言** | 存在 `includes/admin/tab-blog.php` |
| **断言** | `page.php` 调用 `ybb_sm_admin_tab_blog_router`（或等价） |
| **断言** | 不再包含巨型 `ybb_sm_admin_blog_block` 于 `page.php`（已迁移） |

### TC-CONTRACT-02 — merge sanitizer

| 项 | 内容 |
|----|------|
| **断言** | `class-sanitize.php` 含 `ybb_sm_sanitize_blog_merge_article` |
| **断言** | 含 `ybb_sm_blog_save_mode` 分支（`list` / `article`） |
| **断言** | 含 `ybb_sm_sanitize_blog_list_partial` |

### TC-CONTRACT-03 — admin assets

| 项 | 内容 |
|----|------|
| **断言** | `ybb-site-manager.php` enqueue `admin-blog.js` / `admin-blog.css` |
| **断言** | JS 含 `data-ybb-field` 或 `syncBlockFields` 显隐逻辑 |

### TC-CONTRACT-04 — 回归不破坏实时链路

```powershell
Set-Location "D:\开发\fishAgent\总包\skill\reverse-skill\omc-replica\ybb-site"
py scripts/test_blog_admin_ux_contract.py
py scripts/test_blog_content_blocks_contract.py
py scripts/test_blog_realtime_contract.py
```

| 项 | 期望 |
|----|------|
| 三个脚本 | exit code **0** |

---

## 4. 后台 UI 测试用例

### TC-ADMIN-01 — 默认列表视图

| 项 | 内容 |
|----|------|
| **步骤** | 打开 `...&tab=blog`（无 `article` 参数） |
| **期望** | 显示文章表格，≥10 行 |
| **期望** | 页面**不**含「Content blocks」大块表单区（无全量 block 编辑） |
| **期望** | 含博客全局：启用、URL handle、列表标题 |

### TC-ADMIN-02 — 搜索

| 项 | 内容 |
|----|------|
| **步骤** | 搜索框输入 `catalog` |
| **期望** | 仅显示标题/handle 匹配行（如 `2026-catalog-launch`） |
| **步骤** | 清除搜索 |
| **期望** | 恢复全部行 |

### TC-ADMIN-03 — 筛选首页轮播

| 项 | 内容 |
|----|------|
| **步骤** | 筛选「仅首页轮播」 |
| **期望** | 仅 `featuredOnHome=true` 的文章 |
| **期望** | 每行「首页轮播」列为勾选状态 |

### TC-ADMIN-04 — 进入单篇编辑

| 项 | 内容 |
|----|------|
| **步骤** | 点击 `2026-catalog-launch` 的「编辑」 |
| **期望** | URL 含 `&article=2026-catalog-launch` |
| **期望** | 页头有「返回文章列表」 |
| **期望** | 仅 1 篇文章的元数据表单 |

### TC-ADMIN-05 — Block type 显隐

| 项 | 内容 |
|----|------|
| **前置** | 在单篇编辑页 |
| **步骤** | 添加块，type=**段落** |
| **期望** | 仅显示「正文」类字段；**不**显示图片 URL、CTA 按钮、checklist 列表 |
| **步骤** | 改为 type=**图文** |
| **期望** | 显示图片、标题、正文、图左/图右；**不**显示 CTA 字段 |

### TC-ADMIN-06 — 添加与删除块

| 项 | 内容 |
|----|------|
| **步骤** | 点击「+ 添加内容块」→ 选择「引用」 |
| **期望** | 新增一块，type=quote |
| **步骤** | 点击该块「删除」 |
| **期望** | 块从 DOM 移除；保存后 REST 无该 block id |

### TC-ADMIN-07 — 块排序

| 项 | 内容 |
|----|------|
| **前置** | 文章至少有 2 个 enabled blocks |
| **步骤** | 将块 2「上移」 |
| **期望** | 保存后 REST `contentBlocks` 顺序与 UI 一致（`sortOrder` 递增） |

### TC-ADMIN-08 — 图片缩略图

| 项 | 内容 |
|----|------|
| **步骤** | 封面图点击「选择图片」，选媒体库一张图 |
| **期望** | URL 填入 input；旁侧出现 **缩略图预览**（非仅 URL 文本） |

### TC-ADMIN-09 — Legacy 导入（如适用）

| 项 | 内容 |
|----|------|
| **前置** | 找一篇仅 `content[]`、无 `contentBlocks` 的测试副本（或恢复默认后抽样） |
| **步骤** | 点击「将旧版段落导入为内容块」 |
| **期望** | 生成 ≥1 个 paragraph block；legacy textarea 隐藏或清空 |
| **步骤** | 保存 |
| **期望** | REST 同时有 `contentBlocks` 与 `content`（fallback 保留） |

### TC-ADMIN-10 — 中文文案

| 项 | 内容 |
|----|------|
| **期望** | 按钮为「选择图片」非 `Pick image` |
| **期望** | 勾选为「显示」「首页轮播」非 `Show` / `Homepage` |
| **期望** | 块类型下拉为中文（段落、小标题、引用…） |

### TC-ADMIN-11 — 预览链接

| 项 | 内容 |
|----|------|
| **步骤** | 编辑页点击「预览前台」 |
| **期望** | 新标签打开 `https://carp-ybb.com/blogs/news/{handle}?_=` |
| **期望** | HTTP 200（已有 handle） |

### TC-ADMIN-12 — 列表行内 toggle 保存

| 项 | 内容 |
|----|------|
| **步骤** | 列表页取消 `ARTICLE_B` 的「显示」→ 保存 |
| **期望** | REST 该文 `enabled: false`（或不在 enabled 列表） |
| **步骤** | 恢复勾选 |

### TC-ADMIN-13 — 无 JS 降级（可选）

| 项 | 内容 |
|----|------|
| **步骤** | 禁用浏览器 JS，打开单篇编辑 |
| **期望** | PHP 服务端仍按当前 type 隐藏无关字段（初态正确） |
| **期望** | 仍可保存（无动态增删块） |

---

## 5. 数据安全 / Sanitizer 测试用例

### TC-DATA-01 — 单篇保存不覆盖其他文章

| 项 | 内容 |
|----|------|
| **前置** | `curl` 记录 `ARTICLE_B` 的 `title` 为 `TITLE_B_SNAPSHOT` |
| **步骤** | 仅编辑 `ARTICLE_A` 标题为 `TITLE_A_TEST` → 保存 |
| **步骤** | 再次 `curl` 全文 blog REST |
| **断言** | `ARTICLE_A.title === TITLE_A_TEST` |
| **断言** | `ARTICLE_B.title === TITLE_B_SNAPSHOT`（**完全一致**） |
| **断言** | `articles.length === 10` |

```powershell
$t=[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
curl.exe -sS "https://carp-ybb.com/wp-json/ybb/v1/site-manager/blog?_=$t" | Out-File blog-before.json
# ... 后台改 A 标题保存 ...
curl.exe -sS "https://carp-ybb.com/wp-json/ybb/v1/site-manager/blog?_=$t" | Out-File blog-after.json
```

### TC-DATA-02 — 单篇 block 变更不丢其他篇 blocks

| 项 | 内容 |
|----|------|
| **前置** | `ARTICLE_B` 若有 `contentBlocks`，记录 block count |
| **步骤** | 仅改 `ARTICLE_A` 的一个 paragraph `text` |
| **断言** | `ARTICLE_B.contentBlocks` 长度与内容不变 |

### TC-DATA-03 — 列表 partial 不清空正文

| 项 | 内容 |
|----|------|
| **步骤** | 列表页仅 toggle `ARTICLE_A` 首页轮播 → 保存 |
| **断言** | `ARTICLE_A.content` / `contentBlocks` 与保存前 REST 一致 |
| **断言** | 仅 `featuredOnHome` 变化 |

### TC-DATA-04 — 恶意 POST 缺字段

| 项 | 内容 |
|----|------|
| **步骤** | （开发手工）POST `ybb_sm_blog_save_mode=article` 但空 `article` |
| **期望** | 该 handle 数据不变或保存被拒绝；**永不** `articles=[]` |

### TC-DATA-05 — 恢复默认

| 项 | 内容 |
|----|------|
| **步骤** | 博客 Tab →「恢复本 Tab 默认」→ 确认 |
| **期望** | REST 恢复为 `blog-defaults.json` 10 篇 |
| **注意** | 测试环境执行；生产需慎用 |

---

## 6. REST API 回归用例

### TC-REST-01 — blog 全量结构

| 项 | 内容 |
|----|------|
| **步骤** | `GET /wp-json/ybb/v1/site-manager/blog?_={ts}` |
| **期望** | HTTP 200 |
| **断言** | 顶层：`enabled`, `handle`, `title`, `description`, `articles[]` |
| **断言** | 文章含：`handle`, `title`, `content`, `contentBlocks`, `featuredOnHome`, `href` |

### TC-REST-02 — latest-stories 仍轻量

| 项 | 内容 |
|----|------|
| **步骤** | `GET /wp-json/ybb/v1/latest-stories?_={ts}` |
| **断言** | 卡片**无** `content` / `contentBlocks` 字段 |
| **断言** | 含 `handle`, `title`, `excerpt`, `image`, `href` |

### TC-REST-03 — featuredOnHome 与轮播一致

| 项 | 内容 |
|----|------|
| **步骤** | 列表取消 `ARTICLE_A` 首页轮播并保存 |
| **步骤** | `GET latest-stories` |
| **断言** | 返回列表**不**含 `ARTICLE_A.handle` |
| **清理** | 恢复勾选 |

---

## 7. 前台实时性测试用例（无 redeploy）

### TC-FE-01 — 改标题

| 项 | 内容 |
|----|------|
| **步骤** | 后台 `ARTICLE_A` 标题改为 `TITLE_A_TEST` → 保存 |
| **步骤** | **不执行 build/deploy** |
| **步骤** | 浏览器硬刷新 `/blogs/news/2026-catalog-launch` |
| **期望** | `<h1>` 显示 `TITLE_A_TEST` |
| **清理** | 恢复原标题 |

### TC-FE-02 — 改段落 block

| 项 | 内容 |
|----|------|
| **步骤** | 编辑 `ARTICLE_A` 第一个 paragraph block 为 `BLOCK_TEXT_TEST` |
| **步骤** | 硬刷新文章页 |
| **期望** | 正文可见 `BLOCK_TEXT_TEST` |

### TC-FE-03 — 改封面图

| 项 | 内容 |
|----|------|
| **步骤** | 更换 `ARTICLE_A` 封面 URL |
| **步骤** | 硬刷新 |
| **期望** | Hero 图 URL 更新 |

### TC-FE-04 — 博客列表页

| 项 | 内容 |
|----|------|
| **步骤** | 改博客列表 `title` 为 `TEST List Title` |
| **步骤** | 硬刷新 `/blogs/news` |
| **期望** | 列表页主标题更新 |

### TC-FE-05 — 首页 Latest Stories

| 项 | 内容 |
|----|------|
| **步骤** | 取消某文首页轮播 → 保存 |
| **步骤** | 硬刷新首页 |
| **期望** | 轮播少一张该文卡片 |

### TC-FE-06 — 首屏 fallback 闪烁（记录项）

| 项 | 内容 |
|----|------|
| **步骤** | 改标题后硬刷新，观察 Network |
| **期望** | 先可能出现旧标题，REST 返回后更新（已知行为） |
| **期望** | `data-ybb-blog-ready="1"` 出现后为新内容 |

### TC-FE-07 — 新 handle 404（边界）

| 项 | 内容 |
|----|------|
| **步骤** | （若启用新建）创建 handle `test-bax-new-article` 并保存 |
| **步骤** | 访问 `/blogs/news/test-bax-new-article` |
| **期望** | **404**（未 deploy 时）— 文档化预期，非缺陷 |

---

## 8. 审计与运维用例

### TC-OPS-01 — 操作记录

| 项 | 内容 |
|----|------|
| **步骤** | 保存单篇文章 |
| **步骤** | 打开「操作记录」Tab |
| **期望** | 有 `blog` 模块条目，摘要含 handle 或「单篇保存」 |

### TC-OPS-02 — REST 探测（audit 内置）

| 项 | 内容 |
|----|------|
| **期望** | 保存后 audit 详情 REST 探测 `blog` 为 success（沿用 v1.1.0 机制） |

### TC-OPS-03 — mu-plugin 上传验收

```powershell
Set-Location "D:\开发\fishAgent\总包\skill\reverse-skill\omc-replica\ybb-site"
py scripts/upload-ybb-site-manager.py
```

| 项 | 期望 |
|----|------|
| 上传 | exit 0 |
| 版本 | `YBB_SM_VERSION` === `1.10.0` |

---

## 9. 回归矩阵（与其他模块）

| 场景 | 期望 | ID |
|------|------|-----|
| 产品 Tab 仍可搜索保存 | 不受影响 | R-01 |
| 首页模块 Latest Stories 开关 | 仍控制总开关 | R-02 |
| Hero / 导航保存 | 不受影响 | R-03 |
| `BlogContentBlocks` 渲染 7 种 type | 不变 | R-04 |
| latest-stories 委托 `ybb_sm_blog_home_cards` | 不变 | R-05 |
| deploy 状态 / Sync | 不因博客编辑触发 | R-06 |

---

## 10. 测试执行顺序（推荐）

```
1. TC-CONTRACT-01 ~ 04（本地，改代码后）
2. TC-ADMIN-01 ~ 04（冒烟：路由）
3. TC-DATA-01 ~ 03（数据安全，必做）
4. TC-FE-01 ~ 05（前台实时，必做）
5. TC-REST-01 ~ 03
6. TC-ADMIN-05 ~ 12（UI 全量）
7. 回归矩阵 R-01 ~ R-06
8. TC-DATA-05 / TC-FE-07（边界，可选）
9. 清理：恢复 TITLE_A / toggles
```

---

## 11. 通过标准

| 类别 | 通过条件 |
|------|----------|
| **阻断** | TC-DATA-01/02/03 全 PASS |
| **阻断** | TC-FE-01/02 PASS（证明无 redeploy 实时） |
| **阻断** | 三个 contract 脚本 exit 0 |
| **阻断** | TC-REST-01/02 PASS |
| **建议** | TC-ADMIN-05 ~ 12 全 PASS |
| **已知限制** | TC-FE-07 新 URL 404 记为「预期」非失败 |

---

## 12. 缺陷分级

| 级别 | 定义 | 示例 |
|------|------|------|
| P0 | 丢数据 / 他文被清空 | TC-DATA-01 失败 |
| P0 | 前台已有文章改后不更新（REST 也未变） | TC-FE-01 REST 与 UI 均未变 |
| P1 | type 显隐错误导致保存脏字段 | quote 块写入 imageUrl |
| P1 | 列表 toggle 误清正文 | TC-DATA-03 失败 |
| P2 | 文案未中文化、缩略图样式 | TC-ADMIN-10 |
| P3 | 预览链接缺 cache-bust | 仍可用但缓存风险 |
