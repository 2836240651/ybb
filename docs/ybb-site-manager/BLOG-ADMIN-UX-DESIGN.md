# 博客后台运营 UX 重构 — 技术设计（方案 A / BAX）

> **方案代号：** Blog Admin UX（BAX）  
> **版本：** 1.0  
> **父能力：** `contentBlocks` 富文本块（`2026-07-07-blog-content-blocks-design.md`）  
> **配套实施包：** `BLOG-ADMIN-UX-IMPLEMENTATION-PACK.md`  
> **配套测试：** `BLOG-ADMIN-UX-TEST-CASES.md`  
> **mu-plugin 目标版本：** 1.10.0

---

## 1. 背景与问题

### 1.1 现状

| 项 | 当前实现 | 问题 |
|----|----------|------|
| 布局 | `page.php` → `ybb_sm_admin_tab_blog()` 单页平铺全部文章 | 默认 10 篇 × 每篇 3+ block ≈ **500+ 表单控件**，页面极长 |
| Block 编辑 | `ybb_sm_admin_blog_block()` 7 种 type **全字段同时展示** | 运营像填 JSON，不知该填哪些 |
| 新增 block | 预置 2 个 `enabled=false` 占位块，提示「启用后保存」 | 反直觉，无删除/排序 UI |
| 正文入口 | `contentBlocks` + `contentText` legacy 双轨 | 认知负担高，易改错 |
| 语言 | 中英混杂（`Pick image`、`Sort order`） | 运营不友好 |
| 预览 | 无缩略图、无预览链接 | 改完不知是否生效 |
| 文档 | `ADMIN-UX.md` 未收录 Blog Tab | 规范缺失 |
| 对标 Tab | **产品** Tab 有搜索/分页/表格式列表 | 体验断层 |

### 1.2 数据与前台（不变）

```
wp_options: ybb_site_manager_settings.blog
    ↓ 保存（options.php POST）
GET /ybb/v1/site-manager/blog?_={ts}
    ↓ client fetch（cache: no-store）
BlogIndexView / BlogArticleView / BlogCarousel（latest-stories）
```

**已有文章**内容变更：**无需静态 redeploy**，硬刷新前台即可。  
**新 handle URL**、**SEO meta**：仍须 `npm run build` + 部署（静态 `output: "export"` 限制，本方案不解决）。

### 1.3 目标

1. 博客 Tab 拆为 **列表视图** + **单篇编辑视图**，单页表单控件降 **≥90%**。
2. Content block 按 **type 显隐字段**，中文标签 + 行内帮助。
3. 显式 **添加块 / 删除块 / 上移下移**，去掉占位块模式。
4. 有 `contentBlocks` 时 **隐藏 legacy `contentText`**（保留 sanitizer 兼容）。
5. 保存后提供 **预览链接** 与运营提示（刷新前台、无需 redeploy）。
6. **不改动** REST 契约、前台 React 组件、Latest Stories 数据流。

### 1.4 非目标

- 不做 WYSIWYG / Gutenberg（延续 contentBlocks 结构化方案）。
- 不做单篇 REST PUT（方案 C，后续迭代）。
- 不做 iframe 实时预览双栏（方案 B，后续迭代）。
- 不迁移为 WP 原生 Posts。
- 不自动解决「新文章 URL 404」（仍提示需 deploy）；可选提供「复制 handle 给开发部署」工作流。

---

## 2. 信息架构

### 2.1 URL 路由（WP Admin）

| 视图 | URL | 说明 |
|------|-----|------|
| 列表 | `admin.php?page=ybb-site-manager&tab=blog` | 博客全局设置 + 文章表格 |
| 编辑 | `...&tab=blog&article={handle}` | 单篇文章 + 其 contentBlocks |
| 新建 | `...&tab=blog&article=_new` | 可选 Phase 1.1；见 §6 |

`article` 参数经 `sanitize_title()` 处理；`_new` 为保留字。

### 2.2 列表视图线框

```
┌─ 博客全局设置（折叠 details，默认展开）──────────────┐
│ [√] 启用博客  URL handle  列表标题  列表描述          │
│ 提示：Latest Stories 总开关在「首页模块」Tab          │
└────────────────────────────────────────────────────┘

┌─ 文章列表 ─────────────────────────────────────────┐
│ [搜索标题/handle]  [筛选：全部 | 仅首页轮播 | 已隐藏] │
│ ┌────┬────────┬──────┬────┬──────┬──────────────┐ │
│ │封面│ 标题     │ 日期 │显示│首页  │ 操作          │ │
│ ├────┼────────┼──────┼────┼──────┼──────────────┤ │
│ │thumb│2026 Cat…│01-10 │ √ │ √   │[编辑][预览]   │ │
│ └────┴────────┴──────┴────┴──────┴──────────────┘ │
│ [+ 新建文章]（Phase 1.1，带 deploy 提示）            │
└────────────────────────────────────────────────────┘
[保存全局设置]  ← 仅提交 blog 顶层字段 + 列表行内 toggles
```

列表行内允许快速切换 **显示** / **首页轮播**（`featuredOnHome`），无需进入编辑页。

### 2.3 编辑视图线框

```
← 返回文章列表

文章：2026 Wholesale Catalog Now Available
[√] 显示  [√] 首页轮播（Latest Stories）

┌─ 基本信息 ─────────────────────────────────────────┐
│ URL handle | 标题 | 摘要 | 发布日期(date) | 作者      │
│ 封面图 [选图] [缩略图预览]                            │
└────────────────────────────────────────────────────┘

┌─ 正文内容块 ─────────────────────────────────────────┐
│ [+ 添加内容块 ▼]  paragraph / heading / quote / …  │
│ ┌─ 块 1 · 段落 ──────────────── [↑][↓][删除] ────┐ │
│ │ 正文（多段用空行分隔）                           │ │
│ └────────────────────────────────────────────────┘ │
│ ┌─ 块 2 · 图文 ───────────────── [↑][↓][删除] ────┐ │
│ │ 图片 [选图][预览] | 侧栏标题 | 正文 | 图左/图右  │ │
│ └────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────┘

（无 contentBlocks 且仅有 legacy 时，显示「导入为段落块」一次性按钮）

[保存本文] [预览前台] [复制验收链接]

保存成功提示：已保存。请硬刷新前台文章页查看（无需重新部署静态包）。
```

---

## 3. 技术方案

### 3.1 文件结构

```
deploy/wp-content/mu-plugins/ybb-site-manager/
├── includes/admin/
│   ├── page.php                    # EDIT：blog case 改为 require tab-blog
│   └── tab-blog.php                # NEW：列表 + 编辑视图
├── assets/
│   ├── admin-blog.js               # NEW：type 显隐、块增删、排序、缩略图
│   └── admin-blog.css              # NEW
├── includes/class-sanitize.php     # EDIT：单篇 merge 模式
├── includes/modules/audit-log.php  # EDIT：blog 单篇保存摘要
└── ybb-site-manager.php            # EDIT：enqueue assets、版本 1.10.0
```

**不改：** `includes/modules/blog.php`（REST）、前台 `components/blog/*`、`lib/site-manager/blog-api.ts`。

### 3.2 保存策略（核心）

#### 模式 A — 列表保存（`ybb_sm_blog_save_mode=list`）

POST 字段：

- `blog[enabled]`, `blog[handle]`, `blog[title]`, `blog[description]`
- `blog[articles][i][enabled]`, `blog[articles][i][featuredOnHome]`, `blog[articles][i][id]`, `blog[articles][i][handle]`（列表行内 toggle 所需最小集）

Sanitizer：对每篇仅更新 `enabled` / `featuredOnHome`，**其余字段从 `$existing` 保留**。

#### 模式 B — 单篇保存（`ybb_sm_blog_save_mode=article`）

POST 字段：

- 隐藏 `ybb_sm_blog_edit_handle` = 当前文章 handle
- `blog[article]` = 单篇文章完整结构（含 `contentBlocks[]`）
- 可选 `blog[enabled]` 等全局字段（编辑页顶栏折叠区）

Sanitizer 新增 `ybb_sm_sanitize_blog_merge_article($input, $existing)`：

```php
function ybb_sm_sanitize_blog_merge_article(array $input, array $existing): array
{
    $editHandle = sanitize_title((string) ($input['_editHandle'] ?? ''));
    $incoming = $input['article'] ?? null;
    // ... sanitize single article via existing row logic ...
    $merged = $existing['articles'] ?? [];
    $found = false;
    foreach ($merged as $i => $row) {
        if (sanitize_title((string) ($row['handle'] ?? '')) === $editHandle) {
            $merged[$i] = $sanitizedArticle;
            $found = true;
            break;
        }
    }
    if (!$found && $editHandle !== '') {
        $merged[] = $sanitizedArticle; // 新建文章（Phase 1.1）
    }
    $existing['articles'] = array_values($merged);
    return ybb_sm_sanitize_blog($existing, $existing); // 或仅返回 merged top-level
}
```

**硬性：** 单篇保存 **不得** 清空未提交的其他文章。

#### 表单 action

仍走 `options.php` + `register_setting('ybb_sm_group')`；`ybb_sm_module=blog` 不变。  
在 `ybb_sm_sanitize_settings()` 入口检测 `$_POST['ybb_sm_blog_save_mode']` 分发。

### 3.3 Content Block 字段矩阵（显隐）

| type | 显示字段 | 隐藏字段 |
|------|----------|----------|
| `paragraph` | `text` | 其余 |
| `heading` | `text`, `level` | 其余 |
| `quote` | `text`, `caption` | 其余 |
| `image` | `imageUrl`, `alt`, `caption`, `width` | 其余 |
| `mediaText` | `imageUrl`, `alt`, `eyebrow`, `title`, `text`, `imageSide` | 其余 |
| `checklist` | `title`, `items`（多行） | 其余 |
| `cta` | `title`, `text`, `buttonLabel`, `href` | 其余 |

实现：`admin-blog.js` 监听 `select[name$="[type]"]` change → `data-ybb-blog-block` 容器 toggle `data-block-type`。

### 3.4 块操作 UX

| 操作 | 实现 |
|------|------|
| 添加块 | JS 克隆 `<template id="ybb-blog-block-tpl">`，追加到列表，`sortOrder` 自动递增 |
| 删除块 | 移除 DOM 行；提交时索引重排，sanitizer 按 array 顺序写 `sortOrder` |
| 上移/下移 | 交换 DOM 节点，更新隐藏 `sortOrder` |
| 图片预览 | `ybb-sm-pick-image` 回调后写入 `<img class="ybb-sm-thumb">` src |

**移除：** 每篇末尾 2 个 `enabled=false` 占位 block。

### 3.5 Legacy 正文处理

| 条件 | UI |
|------|-----|
| `contentBlocks` 非空 | 隐藏 `contentText`；页脚显示「仍保留旧版段落 fallback（只读）」折叠 |
| 仅 `content[]` / `contentText` | 显示 banner + 按钮「将旧版段落导入为内容块」→ JS 生成 paragraph blocks 并清空 contentText |
| 保存 | sanitizer 逻辑不变：`contentText` 仍映射为 `content[]`；有 enabled blocks 时前台优先 blocks |

### 3.6 中文文案规范

| 原英文 | 中文 |
|--------|------|
| Enable blog | 启用博客 |
| Show | 显示 |
| Homepage | 首页轮播 |
| Pick image | 选择图片 |
| Content blocks | 正文内容块 |
| Legacy paragraph fallback | 旧版段落（兼容） |
| Type paragraph | 段落 |
| Type mediaText | 图文 |
| Sort order | 排序（自动，运营不可见或只读） |

### 3.7 预览与验收链接

```php
function ybb_sm_admin_blog_preview_url(string $blogHandle, string $articleHandle): string
{
    return add_query_arg(
        '_',
        (string) time(),
        home_url('/blogs/' . trim($blogHandle, '/') . '/' . trim($articleHandle, '/'))
    );
}
```

编辑页按钮 `target="_blank"` 打开；列表页每行「预览」同逻辑。

### 3.8 审计日志

`audit-log.php` 保存摘要扩展：

- `module=blog`, `action=save_list` — 变更篇数 / toggle 数
- `module=blog`, `action=save_article`, `detail=handle:2026-catalog-launch` — 块数、标题是否变更

保存后 REST 探测仍为 `GET /ybb/v1/site-manager/blog`（已有逻辑）。

---

## 4. 与前台实时性的关系

| 变更类型 | 后台保存后 | 需 redeploy |
|----------|------------|-------------|
| 标题/摘要/作者/日期 | 硬刷新文章页可见 | 否 |
| contentBlocks 增删改 | 硬刷新文章页可见 | 否 |
| 封面图 URL | 硬刷新可见 | 否 |
| featuredOnHome | 硬刷新首页轮播可见 | 否 |
| 列表页 blog title/description | 硬刷新 `/blogs/{handle}` 可见 | 否 |
| 新 article handle（新 URL） | 可能 404 直至 deploy | **是** |
| `<title>` meta（generateMetadata） | 可能仍为 build 时静态值 | **是**（本方案不改） |

---

## 5. 风险与缓解

| 风险 | 缓解 |
|------|------|
| 单篇保存误删其他文章 | merge sanitizer + 契约测试 `test_blog_admin_merge_contract.py` |
| `max_input_vars` | 单篇编辑字段数 < 80，远低于全量 500+ |
| JS 未加载导致全字段展示 | 无 JS 时仍可按 type 用 PHP `style="display:none"` 服务端初态显隐 |
| 新建文章 404 | UI 明确警告 + OPS runbook 增补 |
| opcode 缓存 | 沿用 `YBB_SM_VERSION` bump + `opcache_invalidate` |

---

## 6. 分期（本设计 = Phase 1）

| 阶段 | 内容 |
|------|------|
| **Phase 1（本方案）** | 列表 + 单篇编辑 + type 显隐 + 块增删排序 + 中文 + 预览链接 |
| Phase 1.1（可选同期） | 新建文章（`_new`）+ deploy 提醒邮件/工单模板 |
| Phase 2（方案 B） | iframe 预览双栏 + 块卡片摘要 |
| Phase 3（方案 C） | 单篇 REST PUT + AJAX 保存 |

---

## 7. 验收标准（摘要）

- 列表页 DOM 文章卡片 ≤ 1 屏设置 + 表格（无全文 block 表单）。
- 编辑页仅 1 篇文章的 block 表单。
- 保存单篇后其他 9 篇 REST 字段不变（抽样 diff）。
- 改标题后 `curl blog REST` + 硬刷新前台一致。
- `py scripts/test_blog_realtime_contract.py` 仍 PASS。
- 新增 `py scripts/test_blog_admin_ux_contract.py` PASS。

---

## 8. 参考文件

| 文件 | 用途 |
|------|------|
| `includes/admin/page.php` | 现有 `ybb_sm_admin_tab_blog` / `ybb_sm_admin_blog_block` |
| `includes/admin/tab-products.php` | 列表/搜索模式参考 |
| `includes/class-sanitize.php` | `ybb_sm_sanitize_blog*` |
| `docs/superpowers/specs/2026-07-07-blog-content-blocks-design.md` | Block 类型定义 |
| `scripts/test_blog_content_blocks_contract.py` | REST/渲染契约 |
