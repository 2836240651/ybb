# 博客后台运营 UX 重构 — PRD & 实施包（BAX）

> **配套技术设计：** `BLOG-ADMIN-UX-DESIGN.md`  
> **配套测试用例：** `BLOG-ADMIN-UX-TEST-CASES.md`  
> **建议工期：** 1 Sprint（4–6 人日，1 人）  
> **mu-plugin 目标版本：** 1.10.0  
> **前台变更：** 无（仅 mu-plugin + 文档 + 契约测试）

---

## PRD 摘要

### 背景

YBB 站点管理 **博客** Tab 将 10 篇文章与全部 `contentBlocks` 平铺在一页，字段中英混杂、7 种块类型全字段同屏，运营无法高效维护文章。前台已通过 REST 实时读取博客数据，瓶颈仅在 **后台 UX**。

### 用户故事

| 角色 | 故事 | 验收 |
|------|------|------|
| **运营** | 在文章列表快速找到要改的一篇并进入编辑 | 列表有搜索/筛选，点击进入单篇页 |
| **运营** | 编辑正文时只看到当前块类型相关字段 | type=段落 时不出现 CTA 按钮字段 |
| **运营** | 添加/删除/调整块顺序 | 有明确按钮，无需「启用占位块」 |
| **运营** | 保存后知道如何验收 | 有预览链接 +「硬刷新、无需部署」提示 |
| **运营** | 勾选首页轮播不用进编辑页 | 列表行内 toggle + 保存 |
| **开发** | 单篇保存不破坏其他文章数据 | merge 测试 + REST diff PASS |
| **开发** | 不改前台实时链路 | `test_blog_realtime_contract.py` 全绿 |

### 范围（In）

- 博客 Tab：**列表视图** + **单篇编辑视图**（`?article={handle}`）
- 抽出 `includes/admin/tab-blog.php`
- `assets/admin-blog.js` + `admin-blog.css`（type 显隐、块增删、排序、缩略图）
- `class-sanitize.php` 单篇 merge 保存 + 列表轻量保存
- 中文运营文案；移除占位 block 模式
- Legacy `contentText` 折叠/导入为块
- 预览链接、审计日志摘要
- 文档：`ADMIN-UX.md`、`OPS-RUNBOOK-zh.md` 增补
- 契约测试：`scripts/test_blog_admin_ux_contract.py`

### 非目标（Out）

- 前台 React / `blog-api.ts` 改动
- REST 新端点（方案 C）
- iframe 预览（方案 B）
- 新文章 URL 自动 deploy
- WYSIWYG 编辑器
- SEO `generateMetadata` 动态化

### 成功指标

| 指标 | 目标 |
|------|------|
| 博客 Tab 首屏可滚动长度 | 较现状缩短 **≥80%**（列表页） |
| 单篇编辑页表单控件数 | **≤ 80**（含 blocks） |
| 改已有文章标题后前台更新 | 保存 + 硬刷新 **≤ 30s** 可见，**无 redeploy** |
| 单篇保存误伤其他文章 | **0**（自动化 merge 测试） |
| 运营上手 | 无需阅读 REST 路径即可完成编辑 |

---

## Sprint 总览

| Sprint | 代号 | 目标 | 可独立上线 |
|--------|------|------|------------|
| **BAX-1** | **BAX** | 博客后台列表 + 单篇编辑 UX | **是**（仅 mu-plugin） |

**推荐实施顺序：** BAX-01 → BAX-02 → … → BAX-12

---

## BAX-1 任务清单

| ID | 任务 | 文件 | 估时 | 依赖 |
|----|------|------|------|------|
| BAX-01 | 新建 `tab-blog.php` 骨架（列表/编辑路由） | `includes/admin/tab-blog.php` | 4h | — |
| BAX-02 | 列表视图：全局设置 + 文章表格 + 行内 toggle | `tab-blog.php` | 4h | BAX-01 |
| BAX-03 | 编辑视图：元数据 + 块列表容器 | `tab-blog.php` | 4h | BAX-01 |
| BAX-04 | Block 模板 PHP + `<template>` 片段 | `tab-blog.php` | 3h | BAX-03 |
| BAX-05 | `admin-blog.js`（type 显隐、增删、排序、thumb） | `assets/admin-blog.js` | 6h | BAX-04 |
| BAX-06 | `admin-blog.css` | `assets/admin-blog.css` | 2h | BAX-05 |
| BAX-07 | `page.php` 接入 + enqueue | `page.php`, `ybb-site-manager.php` | 2h | BAX-02 |
| BAX-08 | sanitizer 列表轻量保存 | `class-sanitize.php` | 3h | BAX-02 |
| BAX-09 | sanitizer 单篇 merge 保存 | `class-sanitize.php` | 4h | BAX-03 |
| BAX-10 | legacy 导入为块（JS + 保存兼容） | `tab-blog.php`, `admin-blog.js` | 2h | BAX-05 |
| BAX-11 | 预览 URL 助手 + 保存成功 notice | `tab-blog.php` | 1h | BAX-03 |
| BAX-12 | audit-log 摘要扩展 | `modules/audit-log.php` | 2h | BAX-08 |
| BAX-13 | 删除旧 `ybb_sm_admin_tab_blog` / `ybb_sm_admin_blog_block` | `page.php` | 1h | BAX-07 |
| BAX-14 | 契约测试 `test_blog_admin_ux_contract.py` | `scripts/` | 3h | BAX-09 |
| BAX-15 | 版本号 **1.10.0** + opcode bump | `ybb-site-manager.php` | 0.5h | BAX-13 |
| BAX-16 | 上传 mu-plugin 验收 | `scripts/upload-ybb-site-manager.py` | 1h | BAX-15 |
| BAX-17 | 文档增补 | `ADMIN-UX.md`, `OPS-RUNBOOK-zh.md` | 2h | BAX-16 |

**合计：** 约 43.5h（≈ 5–6 人日）

---

## 交付物清单

```
deploy/wp-content/mu-plugins/ybb-site-manager/
├── includes/admin/
│   ├── page.php                    # EDIT（blog → require tab-blog）
│   └── tab-blog.php                # NEW
├── assets/
│   ├── admin-blog.js               # NEW
│   └── admin-blog.css              # NEW
├── includes/class-sanitize.php     # EDIT
├── includes/modules/audit-log.php  # EDIT
└── ybb-site-manager.php            # EDIT → 1.10.0

omc-replica/ybb-site/
├── scripts/test_blog_admin_ux_contract.py   # NEW
└── docs/ybb-site-manager/
    ├── BLOG-ADMIN-UX-DESIGN.md              # NEW
    ├── BLOG-ADMIN-UX-IMPLEMENTATION-PACK.md # NEW
    ├── BLOG-ADMIN-UX-TEST-CASES.md          # NEW
    ├── ADMIN-UX.md                          # EDIT
    └── OPS-RUNBOOK-zh.md                    # EDIT
```

**不交付（明确排除）：** `components/blog/*`、`lib/site-manager/blog-api.ts`、`app/blogs/*`、`npm run build`。

---

## 关键实现片段

### BAX-01 — 视图路由

```php
function ybb_sm_admin_tab_blog_router(string $opt, array $data): void
{
    $article = sanitize_title((string) ($_GET['article'] ?? ''));
    if ($article !== '') {
        ybb_sm_admin_tab_blog_edit($opt, $data, $article);
        return;
    }
    ybb_sm_admin_tab_blog_list($opt, $data);
}
```

`page.php` case `blog` 改为：

```php
case 'blog':
    ybb_sm_admin_tab_blog_router($opt, $all['blog'] ?? ybb_sm_blog_defaults());
    break;
```

### BAX-08/09 — Sanitize 入口

在 `ybb_sm_sanitize_settings()` 中，`$module === 'blog'` 时：

```php
$mode = sanitize_key((string) ($_POST['ybb_sm_blog_save_mode'] ?? 'full'));
if ($mode === 'list') {
    $out['blog'] = ybb_sm_sanitize_blog_list_partial($input['blog'] ?? null, $existing['blog'] ?? []);
} elseif ($mode === 'article') {
    $out['blog'] = ybb_sm_sanitize_blog_merge_article(
        $input['blog'] ?? [],
        $existing['blog'] ?? ybb_sm_blog_defaults(),
        sanitize_title((string) ($_POST['ybb_sm_blog_edit_handle'] ?? ''))
    );
} else {
    $out['blog'] = ybb_sm_sanitize_blog($input['blog'] ?? null, $existing['blog'] ?? []);
}
```

### BAX-05 — Type 显隐（JS）

```javascript
function syncBlockFields($block) {
  var type = $block.find('[data-ybb-block-type]').val() || 'paragraph';
  $block.attr('data-active-type', type);
  $block.find('[data-ybb-field]').each(function () {
    var types = ($(this).data('ybb-field') || '').split(/\s+/);
    $(this).toggle(types.indexOf(type) !== -1 || types.indexOf('*') !== -1);
  });
}
```

PHP 渲染字段时加 `data-ybb-field="paragraph"` 等。

### BAX-11 — 编辑页表单

```php
<input type="hidden" name="ybb_sm_blog_save_mode" value="article" />
<input type="hidden" name="ybb_sm_blog_edit_handle" value="<?php echo esc_attr($handle); ?>" />
<!-- 仅一篇：name="<?php echo esc_attr($opt); ?>[blog][article][title]" -->
```

---

## 上传与发布

### mu-plugin only（本 Sprint 默认路径）

```powershell
Set-Location "D:\开发\fishAgent\总包\skill\reverse-skill\omc-replica\ybb-site"
py scripts/upload-ybb-site-manager.py
```

上传后 **无需** `build-static.ps1` 即可验收博客内容变更（已有文章）。

### 版本与缓存

- `YBB_SM_VERSION` → `1.10.0`
- SiteGround 上传后确认 `ybb_sm_code_version` option 已更新
- wp-admin 硬刷新（Ctrl+F5）清浏览器缓存

---

## Sprint 验收清单（BAX-1 Done）

### 后台

- [ ] `wp-admin` → YBB 站点管理 → **博客** 默认为列表视图
- [ ] 列表可搜索标题/handle；可筛选「仅首页轮播」
- [ ] 行内切换「显示」「首页轮播」后保存，REST 反映
- [ ] 点击「编辑」进入单篇页，URL 含 `&article={handle}`
- [ ] 单篇页仅 1 篇文章表单；块类型切换时字段显隐正确
- [ ] 「+ 添加内容块」可添加 7 种类型；删除/上移/下移有效
- [ ] 选图后显示缩略图预览
- [ ] 有 contentBlocks 时无 legacy 大 textarea（或折叠只读）
- [ ] 「预览前台」链接可打开文章页
- [ ] 保存成功 notice 含「无需重新部署」文案
- [ ] 操作记录有 `blog` + `save_article` 条目

### REST / 数据安全

- [ ] 单篇保存后 `GET .../site-manager/blog?_=` 其他文章 `title`/`contentBlocks` 不变
- [ ] `py scripts/test_blog_admin_ux_contract.py` PASS
- [ ] `py scripts/test_blog_content_blocks_contract.py` PASS（回归）
- [ ] `py scripts/test_blog_realtime_contract.py` PASS（回归）

### 前台（无 redeploy）

- [ ] 修改 `2026-catalog-launch` 标题 → 硬刷新 `/blogs/news/2026-catalog-launch` 可见新标题
- [ ] 修改段落 block 文案 → 硬刷新正文可见
- [ ] 取消 Homepage 勾选 → 硬刷新首页 Latest Stories 该卡消失（总开关需开启）

### 文档

- [ ] `ADMIN-UX.md` 含 Blog Tab 说明
- [ ] `OPS-RUNBOOK-zh.md` 含博客编辑 SOP + 新文章 deploy 提示

---

## 运营手册增补（写入 OPS-RUNBOOK）

| 操作 | 入口 | 生效 |
|------|------|------|
| 改文章标题/正文/块 | 站点管理 → 博客 → 编辑 | 硬刷新文章页，**无需 deploy** |
| 上首页轮播 | 列表勾选「首页轮播」或编辑页勾选 | 硬刷新首页 |
| Latest Stories 总开关 | **首页模块** Tab | 硬刷新首页 |
| 新建文章 URL | 联系开发执行 `build-static.ps1` | 需 deploy 后 URL 可访问 |
| 恢复默认 | 博客 Tab 底部「恢复本 Tab 默认」 | 慎用，恢复全部 10 篇默认数据 |

### 常见问题

**Q: 保存后前台没变？**  
A: 硬刷新（Ctrl+F5）；确认改的是已有 handle；用编辑页「预览」链接验收。

**Q: 新写的文章打不开？**  
A: 新 URL 需静态站 rebuild + 部署生成 HTML 路由。

**Q: 首页轮播没更新？**  
A: 确认「首页模块 → Latest Stories 显示」已开；文章「首页轮播」已勾选。

---

## 回滚方案

1. SiteGround File Manager 恢复上一版 `ybb-site-manager` zip（`deploy/remote-backup/` 如有）
2. 或 git 还原 `tab-blog.php` / `class-sanitize.php`，版本降回 1.9.0 重传
3. `wp_options` 数据不因回滚 UI 而丢失（仅影响编辑体验）

---

## 后续迭代挂钩

| 迭代 | 文档 | 依赖 BAX |
|------|------|----------|
| 方案 B 预览双栏 | `BLOG-ADMIN-UX-PHASE2-*.md`（待写） | BAX 单篇编辑页 |
| 方案 C 单篇 REST | REST-SPEC 增补 | BAX merge sanitizer 可复用 |
| 新文章自助 deploy 提醒 | deploy-queue webhook | BAX-01 新建流程 |
