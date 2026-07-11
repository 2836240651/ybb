<?php

if (!defined('ABSPATH')) {
    exit;
}

const YBB_SM_AUDIT_OPTION = 'ybb_site_manager_audit_log';
const YBB_SM_AUDIT_MAX_ENTRIES = 500;
const YBB_SM_AUDIT_RETENTION_DAYS = 90;

function ybb_sm_audit_module_labels(): array
{
    return [
        'navigation' => '导航',
        'announcements' => '公告',
        'hero' => 'Hero 轮播',
        'home' => '首页模块',
        'blog' => '博客',
        'products' => '产品覆盖',
        'video' => '宣传视频',
        'featured' => 'Featured 主推',
        'brand' => '品牌',
        'contact' => '联系',
        'deploy' => '站点部署',
        'reviews_import' => '评价导入',
        'system' => '系统',
    ];
}

function ybb_sm_audit_action_labels(): array
{
    return [
        'save' => '保存设置',
        'reset' => '恢复默认',
        'deploy_queue' => '加入部署队列',
        'deploy_merge' => '合并部署任务',
        'deploy_start' => '开始部署',
        'deploy_step' => '部署进度',
        'deploy_success' => '部署成功',
        'deploy_failed' => '部署失败',
        'product_publish' => '产品发布',
        'product_update' => '产品更新',
        'import' => '批量导入',
    ];
}

function ybb_sm_audit_rest_routes(): array
{
    return [
        'navigation' => '/ybb/v1/site-manager/navigation',
        'announcements' => '/ybb/v1/site-manager/announcements',
        'hero' => '/ybb/v1/site-manager/hero',
        'blog' => '/ybb/v1/site-manager/blog',
        'products' => '/ybb/v1/site-manager/product-overrides',
        'home' => '/ybb/v1/latest-stories',
        'video' => '/ybb/v1/site-manager/factory-video',
        'featured' => '/ybb/v1/site-manager/featured-product',
        'brand' => '/ybb/v1/site-brand',
        'contact' => '/ybb/v1/site-manager/contact',
    ];
}

function ybb_sm_audit_actor(): array
{
    $user = wp_get_current_user();
    if ($user && $user->ID > 0) {
        return [
            'actorId' => (int) $user->ID,
            'actor' => $user->display_name ?: $user->user_login,
        ];
    }

    return ['actorId' => 0, 'actor' => '系统'];
}

function ybb_sm_audit_get_entries(): array
{
    $stored = get_option(YBB_SM_AUDIT_OPTION, []);
    if (!is_array($stored)) {
        return [];
    }

    return array_values($stored);
}

function ybb_sm_audit_purge_old(): void
{
    $cutoff = time() - (YBB_SM_AUDIT_RETENTION_DAYS * DAY_IN_SECONDS);
    $entries = ybb_sm_audit_get_entries();
    $kept = array_values(array_filter($entries, static function ($row) use ($cutoff) {
        $at = strtotime((string) ($row['at'] ?? ''));
        return $at === false || $at >= $cutoff;
    }));
    if (count($kept) !== count($entries)) {
        update_option(YBB_SM_AUDIT_OPTION, $kept, false);
    }
}

function ybb_sm_audit_append(array $entry): string
{
    $labels = ybb_sm_audit_module_labels();
    $actionLabels = ybb_sm_audit_action_labels();
    $actor = ybb_sm_audit_actor();

    $module = sanitize_key($entry['module'] ?? 'system');
    $action = sanitize_key($entry['action'] ?? 'save');
    $status = sanitize_key($entry['status'] ?? 'info');
    if (!in_array($status, ['success', 'failed', 'running', 'warning', 'info'], true)) {
        $status = 'info';
    }

    $row = [
        'id' => 'log-' . time() . '-' . wp_generate_password(6, false, false),
        'at' => $entry['at'] ?? wp_date('c'),
        'actorId' => (int) ($entry['actorId'] ?? $actor['actorId']),
        'actor' => sanitize_text_field($entry['actor'] ?? $actor['actor']),
        'category' => sanitize_key($entry['category'] ?? ($module === 'deploy' ? 'deploy' : 'config')),
        'module' => $module,
        'moduleLabel' => sanitize_text_field($entry['moduleLabel'] ?? ($labels[$module] ?? $module)),
        'action' => $action,
        'actionLabel' => sanitize_text_field($entry['actionLabel'] ?? ($actionLabels[$action] ?? $action)),
        'status' => $status,
        'summary' => sanitize_text_field($entry['summary'] ?? ''),
        'detail' => sanitize_textarea_field($entry['detail'] ?? ''),
        'nextStep' => sanitize_text_field($entry['nextStep'] ?? ''),
        'meta' => is_array($entry['meta'] ?? null) ? $entry['meta'] : [],
    ];

    if ($row['summary'] === '') {
        $row['summary'] = $row['actionLabel'] . ' · ' . $row['moduleLabel'];
    }

    $entries = ybb_sm_audit_get_entries();
    array_unshift($entries, $row);
    if (count($entries) > YBB_SM_AUDIT_MAX_ENTRIES) {
        $entries = array_slice($entries, 0, YBB_SM_AUDIT_MAX_ENTRIES);
    }
    update_option(YBB_SM_AUDIT_OPTION, $entries, false);
    ybb_sm_audit_purge_old();

    return $row['id'];
}

function ybb_sm_audit_query(array $args = []): array
{
    $category = sanitize_key($args['category'] ?? '');
    $status = sanitize_key($args['status'] ?? '');
    $days = isset($args['days']) ? (int) $args['days'] : 0;
    $page = max(1, (int) ($args['page'] ?? 1));
    $perPage = min(100, max(10, (int) ($args['per_page'] ?? 50)));

    $entries = ybb_sm_audit_get_entries();
    if ($days > 0) {
        $cutoff = time() - ($days * DAY_IN_SECONDS);
        $entries = array_values(array_filter($entries, static function ($row) use ($cutoff) {
            $at = strtotime((string) ($row['at'] ?? ''));
            return $at !== false && $at >= $cutoff;
        }));
    }
    if ($category !== '' && $category !== 'all') {
        $entries = array_values(array_filter($entries, static fn ($r) => ($r['category'] ?? '') === $category));
    }
    if ($status !== '' && $status !== 'all') {
        $entries = array_values(array_filter($entries, static fn ($r) => ($r['status'] ?? '') === $status));
    }

    $total = count($entries);
    $offset = ($page - 1) * $perPage;

    return [
        'items' => array_slice($entries, $offset, $perPage),
        'total' => $total,
        'page' => $page,
        'perPage' => $perPage,
        'pages' => (int) max(1, ceil($total / $perPage)),
    ];
}

function ybb_sm_audit_public_list(array $args = []): array
{
    $result = ybb_sm_audit_query($args);
    $result['syncedAt'] = gmdate('c');

    return $result;
}

function ybb_sm_audit_pick_label(array $labels, string $locale = 'zh'): string
{
    if (!is_array($labels)) {
        return '';
    }
    $v = trim((string) ($labels[$locale] ?? ''));
    if ($v !== '') {
        return $v;
    }

    return trim((string) ($labels['en'] ?? ''));
}

/** 运营可读名称：英�?+ 中文（若有） */
function ybb_sm_audit_item_display_name(array $item, string $fallback = ''): string
{
    $en = trim((string) ($item['label'] ?? $item['title'] ?? ''));
    $zh = ybb_sm_audit_pick_label($item['labels'] ?? [], 'zh');
    if ($zh === '' && isset($item['title']) && !isset($item['label'])) {
        $zh = '';
    }
    if ($en !== '' && $zh !== '' && $zh !== $en) {
        return $en . ' / ' . $zh;
    }
    if ($en !== '') {
        return $en;
    }
    if ($zh !== '') {
        return $zh;
    }
    $ja = ybb_sm_audit_pick_label($item['labels'] ?? [], 'ja');
    if ($ja !== '') {
        return $ja;
    }

    return $fallback !== '' ? $fallback : '未命名项';
}

function ybb_sm_audit_truncate(string $text, int $max = 56): string
{
    $text = preg_replace('/\s+/u', ' ', trim($text));
    if ($text === '') {
        return '（空）';
    }
    if (mb_strlen($text) <= $max) {
        return $text;
    }

    return mb_substr($text, 0, $max) . '…';
}

/** 缩进�?= 具体条目变更（非汇总行�?*/
function ybb_sm_audit_change_lines(array $lines): array
{
    return array_values(array_filter($lines, static function ($line) {
        return (bool) preg_match('/^  [·+\-]/u', (string) $line);
    }));
}

function ybb_sm_audit_build_summary(string $module, array $lines, string $verifyMessage): string
{
    $headlines = array_values(array_filter($lines, static function ($line) {
        return !preg_match('/^  /u', (string) $line);
    }));
    $headline = $headlines[0] ?? '配置已保存';
    if (count($headlines) > 1) {
        $headline .= '；' . implode('；', array_slice($headlines, 1));
    } elseif ($module === 'brand' && strpos($headline, '无字段改动') !== false) {
        // keep as-is
    }

    return implode('；', array_filter([$headline, $verifyMessage]));
}

function ybb_sm_audit_index_by_id(array $rows, string $idKey = 'id'): array
{
    $map = [];
    foreach ($rows as $i => $row) {
        if (!is_array($row)) {
            continue;
        }
        $id = trim((string) ($row[$idKey] ?? ''));
        if ($id === '') {
            $id = 'row-' . $i;
        }
        $map[$id] = $row;
    }

    return $map;
}

function ybb_sm_audit_diff_label_locales(array $before, array $after, string $prefix, array $locales = ['zh' => '中文', 'en' => '英文', 'ja' => '日文']): array
{
    $lines = [];
    foreach ($locales as $loc => $locLabel) {
        $oz = trim((string) ($before[$loc] ?? ''));
        $nz = trim((string) ($after[$loc] ?? ''));
        if ($oz !== $nz) {
            $lines[] = '  · ' . $prefix . $locLabel . '】' . ybb_sm_audit_truncate($oz) . ' → ' . ybb_sm_audit_truncate($nz);
        }
    }

    return $lines;
}

function ybb_sm_audit_diff_module(string $module, array $before, array $after): array
{
    $lines = [];
    $b = $before[$module] ?? [];
    $a = $after[$module] ?? [];

    switch ($module) {
        case 'navigation':
            $bNav = $b['primaryNav'] ?? [];
            $aNav = $a['primaryNav'] ?? [];
            $countVisible = static function (array $nav): int {
                $n = 0;
                foreach ($nav as $item) {
                    if (ybb_sm_item_is_enabled($item)) {
                        $n++;
                    }
                }

                return $n;
            };
            $aVisible = $countVisible($aNav);
            $bVisible = $countVisible($bNav);
            $lines[] = '顶部导航：显�?' . $aVisible . ' 项（�?' . $bVisible . ' 项）';

            $bById = ybb_sm_audit_index_by_id($bNav);
            $seen = [];
            foreach ($aNav as $item) {
                $id = trim((string) ($item['id'] ?? ''));
                if ($id === '') {
                    $id = 'nav-' . ($item['href'] ?? uniqid());
                }
                $seen[] = $id;
                $old = $bById[$id] ?? null;
                $name = ybb_sm_audit_item_display_name($item, $id);

                if (!$old) {
                    $lines[] = '  + 新增导航项【' . $name . '，';
                    continue;
                }

                $oldEn = ybb_sm_item_is_enabled($old);
                $newEn = ybb_sm_item_is_enabled($item);
                if ($oldEn !== $newEn) {
                    $lines[] = '  · 【' . $name . '】' . ($newEn ? '已显示' : '已隐藏');
                }
                if (($old['label'] ?? '') !== ($item['label'] ?? '')) {
                    $lines[] = '  · 【' . $name . '】英文标题：' . ybb_sm_audit_truncate((string) ($old['label'] ?? '')) . ' → ' . ybb_sm_audit_truncate((string) ($item['label'] ?? ''));
                }
                if (($old['href'] ?? '') !== ($item['href'] ?? '')) {
                    $lines[] = '  · 【' . $name . '】链接：' . ($old['href'] ?? '') . ' → ' . ($item['href'] ?? '');
                }
                foreach (['zh' => '中文', 'ja' => '日文'] as $loc => $locLabel) {
                    $oz = ybb_sm_audit_pick_label($old['labels'] ?? [], $loc);
                    $nz = ybb_sm_audit_pick_label($item['labels'] ?? [], $loc);
                    if ($oz !== $nz) {
                        $lines[] = '  · 【' . $name . '】' . $locLabel . '】' . ybb_sm_audit_truncate($oz) . ' → ' . ybb_sm_audit_truncate($nz);
                    }
                }
            }
            foreach ($bById as $id => $old) {
                if (!in_array($id, $seen, true)) {
                    $lines[] = '  - 已移除导航项【' . ybb_sm_audit_item_display_name($old, $id) . '，';
                }
            }
            if (function_exists('ybb_sm_navigation_empty_collection_warnings')) {
                $emptyNav = ybb_sm_navigation_empty_collection_warnings($a);
                foreach ($emptyNav as $warning) {
                    $lines[] = '  ⚠ 空类目：' . ($warning['label'] ?? $warning['handle']) . '【'
                        . '】' . ($warning['handle'] ?? '') . '，Woo publish 0';
                }
            }
            break;

        case 'announcements':
            if (!empty($b['enabled']) !== !empty($a['enabled'])) {
                $lines[] = '公告栏：' . (!empty($a['enabled']) ? '已开启' : '已关闭');
            }
            $bi = $b['items'] ?? [];
            $ai = $a['items'] ?? [];
            $lines[] = '公告条数�? . count($ai) . '（原 ' . count($bi) . '�?;

            $bById = ybb_sm_audit_index_by_id($bi);
            $seen = [];
            foreach ($ai as $item) {
                $id = trim((string) ($item['id'] ?? ''));
                if ($id === '') {
                    continue;
                }
                $seen[] = $id;
                $old = $bById[$id] ?? null;
                if (!$old) {
                    $lines[] = '  + 新增公告�? . $id . '�?;
                    continue;
                }
                $oldEn = ybb_sm_item_is_enabled($old);
                $newEn = ybb_sm_item_is_enabled($item);
                if ($oldEn !== $newEn) {
                    $lines[] = '  · 【' . $id . '】' . ($newEn ? '已显示' : '已隐藏');
                }
                foreach (['zh' => '中文', 'en' => '英文', 'ja' => '日文'] as $loc => $locLabel) {
                    $oz = ybb_sm_audit_pick_label($old['labels'] ?? [], $loc);
                    $nz = ybb_sm_audit_pick_label($item['labels'] ?? [], $loc);
                    if ($oz !== $nz) {
                        $lines[] = '  · 【' . $id . '】' . $locLabel . '】' . ybb_sm_audit_truncate($oz) . ' → ' . ybb_sm_audit_truncate($nz);
                    }
                }
                if (($old['href'] ?? '') !== ($item['href'] ?? '')) {
                    $lines[] = '  · 【' . $id . '】链接已修改';
                }
            }
            foreach ($bById as $id => $old) {
                if (!in_array($id, $seen, true)) {
                    $lines[] = '  - 已移除公告�? . $id . '�?;
                }
            }
            break;

        case 'hero':
            if (!empty($b['enabled']) !== !empty($a['enabled'])) {
                $lines[] = 'Hero：' . (!empty($a['enabled']) ? '已开启' : '已关闭');
            }
            if ((int) ($b['autoplayMs'] ?? 0) !== (int) ($a['autoplayMs'] ?? 0)) {
                $lines[] = '自动播放间隔：' . (int) ($b['autoplayMs'] ?? 0) . 'ms → ' . (int) ($a['autoplayMs'] ?? 0) . 'ms';
            }
            $as = $a['slides'] ?? [];
            $bs = $b['slides'] ?? [];
            $lines[] = '轮播图：' . count($as) . ' 张（�?' . count($bs) . ' 张）';

            $bById = ybb_sm_audit_index_by_id($bs);
            $seen = [];
            foreach ($as as $i => $slide) {
                $id = trim((string) ($slide['id'] ?? ''));
                if ($id === '') {
                    $id = 'slide-' . $i;
                }
                $seen[] = $id;
                $old = $bById[$id] ?? null;
                $name = ybb_sm_audit_item_display_name($slide, '第' . ($i + 1) . '张');

                if (!$old) {
                    $lines[] = '  + 新增轮播�? . $name . '�?;
                    continue;
                }
                $oldEn = ybb_sm_item_is_enabled($old);
                $newEn = ybb_sm_item_is_enabled($slide);
                if ($oldEn !== $newEn) {
                    $lines[] = '  · 【' . $name . '】' . ($newEn ? '已显示' : '已隐藏');
                }
                if (($old['imageUrl'] ?? '') !== ($slide['imageUrl'] ?? '')) {
                    $lines[] = '  · 【' . $name . '】图片已更换';
                }
                if (($old['href'] ?? '') !== ($slide['href'] ?? '')) {
                    $lines[] = '  · 【' . $name . '】链接已修改';
                }
                foreach (['en' => '英文', 'zh' => '中文', 'ja' => '日文'] as $loc => $locLabel) {
                    $oz = ybb_sm_audit_pick_label($old['labels'] ?? [], $loc);
                    $nz = ybb_sm_audit_pick_label($slide['labels'] ?? [], $loc);
                    if ($oz !== $nz) {
                        $lines[] = '  · 【' . $name . '】' . $locLabel . '标题：' . ybb_sm_audit_truncate($oz) . ' → ' . ybb_sm_audit_truncate($nz);
                    }
                }
            }
            foreach ($bById as $id => $old) {
                if (!in_array($id, $seen, true)) {
                    $lines[] = '  - 已移除轮播项【' . ybb_sm_audit_item_display_name($old, $id) . '，';
                }
            }
            break;

        case 'home':
            foreach (
                [
                    'wholesaleCollectionsEnabled' => 'Wholesale 类目区块',
                    'latestStoriesEnabled' => 'Latest Stories 区块',
                    'hotProductsEnabled' => 'Hot Products 区块',
                ] as $key => $label
            ) {
                if (!empty($b[$key]) !== !empty($a[$key])) {
                    $lines[] = $label . '】' . (!empty($a[$key]) ? '已开启' : '已关闭');
                }
            }
            if ((int) ($b['hotProductsAutoplayMs'] ?? 0) !== (int) ($a['hotProductsAutoplayMs'] ?? 0)) {
                $lines[] = 'Hot Products 间隔：' . (int) ($b['hotProductsAutoplayMs'] ?? 0) . 'ms → ' . (int) ($a['hotProductsAutoplayMs'] ?? 0) . 'ms';
            }

            $bHot = ybb_sm_audit_index_by_id($b['hotProducts'] ?? []);
            $seenHot = [];
            foreach ($a['hotProducts'] ?? [] as $row) {
                $id = trim((string) ($row['id'] ?? $row['handle'] ?? ''));
                if ($id === '') {
                    continue;
                }
                $seenHot[] = $id;
                $old = $bHot[$id] ?? null;
                $handle = (string) ($row['handle'] ?? $id);
                if (!$old) {
                    $lines[] = '  + Hot Products 新增：' . $handle . '，';
                    continue;
                }
                if (!empty($old['enabled']) !== !empty($row['enabled'])) {
                    $lines[] = '  · Hot【' . $handle . '】' . (!empty($row['enabled']) ? '已显示' : '已隐藏');
                }
                if (($old['handle'] ?? '') !== ($row['handle'] ?? '')) {
                    $lines[] = '  · Hot 第项 slug：' . ($old['handle'] ?? '') . ' → ' . ($row['handle'] ?? '');
                }
            }
            foreach ($bHot as $id => $old) {
                if (!in_array($id, $seenHot, true)) {
                    $lines[] = '  - Hot 已移除【' . ($old['handle'] ?? $id) . '，';
                }
            }

            $bStories = ybb_sm_audit_index_by_id($b['latestStories'] ?? []);
            $seenStories = [];
            foreach ($a['latestStories'] ?? [] as $row) {
                $id = trim((string) ($row['id'] ?? ''));
                if ($id === '') {
                    continue;
                }
                $seenStories[] = $id;
                $old = $bStories[$id] ?? null;
                $title = (string) ($row['title'] ?? $id);
                if (!$old) {
                    $lines[] = '  + Latest Stories 新增：' . ybb_sm_audit_truncate($title, 40) . '，';
                    continue;
                }
                if (!empty($old['enabled']) !== !empty($row['enabled'])) {
                    $lines[] = '  · Story【' . ybb_sm_audit_truncate($title, 36) . '】' . (!empty($row['enabled']) ? '已显示' : '已隐藏');
                }
                if (($old['title'] ?? '') !== ($row['title'] ?? '')) {
                    $lines[] = '  · Story【' . $id . '】标题：' . ybb_sm_audit_truncate((string) ($old['title'] ?? '')) . ' → ' . ybb_sm_audit_truncate($title);
                }
            }
            foreach ($bStories as $id => $old) {
                if (!in_array($id, $seenStories, true)) {
                    $lines[] = '  - Story 已移除【' . ybb_sm_audit_truncate((string) ($old['title'] ?? $id), 40) . '，';
                }
            }
            break;

        case 'video':
            if (!empty($b['enabled']) !== !empty($a['enabled'])) {
                $lines[] = '视频模块：' . (!empty($a['enabled']) ? '已开启' : '已关闭');
            }
            if (($b['videoUrl'] ?? '') !== ($a['videoUrl'] ?? '')) {
                $lines[] = '  · 视频地址已更新';
            }
            if (($b['posterUrl'] ?? '') !== ($a['posterUrl'] ?? '')) {
                $lines[] = '  · 封面图已更新';
            }
            foreach (['title' => '标题', 'body' => '正文', 'cta' => '按钮'] as $key => $label) {
                $lines = array_merge(
                    $lines,
                    ybb_sm_audit_diff_label_locales(
                        $b['labels'][$key] ?? [],
                        $a['labels'][$key] ?? [],
                        '视频' . $label
                    )
                );
            }
            if (count($lines) === 0) {
                $lines[] = '宣传视频：已保存';
            }
            break;

        case 'blog':
            if (!empty($b['enabled']) !== !empty($a['enabled'])) {
                $lines[] = '博客：' . (!empty($a['enabled']) ? '已开启' : '已关闭');
            }
            if (!empty($b['latestStoriesEnabled']) !== !empty($a['latestStoriesEnabled'])) {
                $lines[] = 'Latest Stories 轮播：' . (!empty($a['latestStoriesEnabled']) ? '已开启' : '已关闭');
            }
            if (($b['handle'] ?? '') !== ($a['handle'] ?? '')) {
                $lines[] = '  · 博客 handle：' . ($b['handle'] ?? '') . ' → ' . ($a['handle'] ?? '');
            }
            if (($b['title'] ?? '') !== ($a['title'] ?? '')) {
                $lines[] = '  · 列表标题已修改';
            }
            if (($b['description'] ?? '') !== ($a['description'] ?? '')) {
                $lines[] = '  · 列表描述已修改';
            }

            $bArticles = ybb_sm_audit_index_by_id($b['articles'] ?? []);
            $seen = [];
            foreach ($a['articles'] ?? [] as $i => $row) {
                $id = trim((string) ($row['id'] ?? $row['handle'] ?? ''));
                if ($id === '') {
                    $id = 'article-' . $i;
                }
                $seen[] = $id;
                $old = $bArticles[$id] ?? null;
                $name = ybb_sm_audit_item_display_name($row, (string) ($row['handle'] ?? $id));

                if (!$old) {
                    $lines[] = '  + 新增文章�? . $name . '�?;
                    continue;
                }
                if (!empty($old['enabled']) !== !empty($row['enabled'])) {
                    $lines[] = '  · 【' . $name . '】' . (!empty($row['enabled']) ? '已显示' : '已隐藏');
                }
                if (!empty($old['featuredOnHome']) !== !empty($row['featuredOnHome'])) {
                    $lines[] = '  · 【' . $name . '】首页展示：' . (!empty($row['featuredOnHome']) ? '是' : '否');
                }
                if (($old['title'] ?? '') !== ($row['title'] ?? '')) {
                    $lines[] = '  · 【' . $name . '】标题已修改';
                }
                if (($old['imageUrl'] ?? '') !== ($row['imageUrl'] ?? '')) {
                    $lines[] = '  · 【' . $name . '】头图已更换';
                }
                if (($old['excerpt'] ?? '') !== ($row['excerpt'] ?? '')) {
                    $lines[] = '  · 【' . $name . '】摘要已修改';
                }
                if (json_encode($old['content'] ?? []) !== json_encode($row['content'] ?? [])) {
                    $lines[] = '  · 【' . $name . '】正文已修改';
                }
            }
            foreach ($bArticles as $id => $old) {
                if (!in_array($id, $seen, true)) {
                    $lines[] = '  - 已移除文章【' . ybb_sm_audit_item_display_name($old, $id) . '，';
                }
            }
            if (count($lines) === 0) {
                $lines[] = '博客：已保存（无字段改动';
            }
            break;

        case 'products':
            if (!empty($b['enabled']) !== !empty($a['enabled'])) {
                $lines[] = '产品覆盖：' . (!empty($a['enabled']) ? '已开启' : '已关闭');
            }
            $bPdp = is_array($b['pdp'] ?? null) ? $b['pdp'] : [];
            $aPdp = is_array($a['pdp'] ?? null) ? $a['pdp'] : [];
            if ($bPdp !== $aPdp) {
                $lines[] = '  · 全站购买区 slogan 默认已更新';
            }
            $bOverrides = is_array($b['overrides'] ?? null) ? $b['overrides'] : [];
            $aOverrides = is_array($a['overrides'] ?? null) ? $a['overrides'] : [];
            $handles = array_unique(array_merge(array_keys($bOverrides), array_keys($aOverrides)));
            $changed = 0;
            foreach ($handles as $handle) {
                $old = $bOverrides[$handle] ?? null;
                $new = $aOverrides[$handle] ?? null;
                if ($old == $new) {
                    continue;
                }
                $changed++;
                if (!$old && $new) {
                    $lines[] = '  + 覆盖�? . $handle . '�?;
                } elseif ($old && !$new) {
                    $lines[] = '  - 移除覆盖�? . $handle . '�?;
                } else {
                    $lines[] = '  · 更新覆盖�? . $handle . '�?;
                    if (($old['galleryEnabled'] ?? true) !== ($new['galleryEnabled'] ?? true)) {
                        $lines[] = '    - 图库启用：' . (!empty($old['galleryEnabled']) ? '是' : '否') . ' → ' . (!empty($new['galleryEnabled']) ? '是' : '否');
                    }
                    if ((int) ($old['galleryDefaultIndex'] ?? 0) !== (int) ($new['galleryDefaultIndex'] ?? 0)) {
                        $lines[] = '    - 默认图序号：' . (int) ($old['galleryDefaultIndex'] ?? 0) . ' → ' . (int) ($new['galleryDefaultIndex'] ?? 0);
                    }
                    if (json_encode($old['galleryImages'] ?? []) !== json_encode($new['galleryImages'] ?? [])) {
                        $lines[] = '    - 覆盖图库 URL 已修改';
                    }
                    if (json_encode($old['galleryHideIndexes'] ?? []) !== json_encode($new['galleryHideIndexes'] ?? [])) {
                        $lines[] = '    - 隐藏序号已修改';
                    }
                }
            }
            if ($changed === 0 && count($lines) === 0) {
                $lines[] = '产品覆盖：已保存（无字段改动';
            }
            break;

        case 'featured':
            if (!empty($b['enabled']) !== !empty($a['enabled'])) {
                $lines[] = 'Featured：' . (!empty($a['enabled']) ? '已开启' : '已关闭');
            }
            if (($b['handle'] ?? '') !== ($a['handle'] ?? '')) {
                $lines[] = '  · 主推产品：' . ($b['handle'] ?? '（空�?) . ' → ' . ($a['handle'] ?? '（空�?);
            } elseif (count($lines) === 0) {
                $lines[] = 'Featured 主推：已保存（slug 无改动）';
            }
            break;

        case 'brand':
            if (($b['name'] ?? '') !== ($a['name'] ?? '')) {
                $lines[] = '  · 品牌名：' . ybb_sm_audit_truncate((string) ($b['name'] ?? '')) . ' → ' . ybb_sm_audit_truncate((string) ($a['name'] ?? ''));
            }
            if (($b['logoPath'] ?? '') !== ($a['logoPath'] ?? '')) {
                $lines[] = '  · Logo 路径已修改';
            }
            $lines = array_merge(
                $lines,
                ybb_sm_audit_diff_label_locales($b['tagline'] ?? [], $a['tagline'] ?? [], '副标题')
            );
            if (count($lines) === 0) {
                $lines[] = '品牌：已保存（无字段改动';
            }
            break;

        case 'contact':
            if (($b['salesEmail'] ?? '') !== ($a['salesEmail'] ?? '')) {
                $lines[] = '  · 销售邮箱：' . ybb_sm_audit_truncate((string) ($b['salesEmail'] ?? '')) . ' → ' . ybb_sm_audit_truncate((string) ($a['salesEmail'] ?? ''));
            }
            if (($b['phoneNumber'] ?? '') !== ($a['phoneNumber'] ?? '')) {
                $lines[] = '  · 电话已修改';
            }
            if (($b['companyLegalName'] ?? '') !== ($a['companyLegalName'] ?? '')) {
                $lines[] = '  · 公司名（英文）已修改';
            }
            if (($b['companyLegalNameZh'] ?? '') !== ($a['companyLegalNameZh'] ?? '')) {
                $lines[] = '  · 公司名（中文）已修改';
            }
            $lines = array_merge(
                $lines,
                ybb_sm_audit_diff_label_locales($b['intro'] ?? [], $a['intro'] ?? [], '导语'),
                ybb_sm_audit_diff_label_locales($b['hoursDetail'] ?? [], $a['hoursDetail'] ?? [], '工作时间')
            );
            if (count($lines) === 0) {
                $lines[] = '联系页：已保存（无字段改动）';
            }
            break;

        default:
            $lines[] = '配置已更新';
    }

    if (ybb_sm_audit_change_lines($lines) === [] && count($lines) === 1 && strpos($lines[0], '已保存') === false) {
        $lines[] = '  · 本次保存未检测到条目级差异（可能与上次相同）';
    }

    return [
        'summary' => $lines[0] ?? '配置已保存',
        'detail' => implode("\n", $lines),
        'lines' => $lines,
    ];
}

function ybb_sm_audit_verify_rest(string $module): array
{
    $routes = ybb_sm_audit_rest_routes();
    if (!isset($routes[$module])) {
        return ['http' => 0, 'status' => 'skip', 'message' => ''];
    }

    $url = add_query_arg(
        ['rest_route' => $routes[$module], '_' => (string) time()],
        home_url('/index.php')
    );
    $response = wp_remote_get($url, ['timeout' => 15, 'headers' => ['Cache-Control' => 'no-cache']]);

    if (is_wp_error($response)) {
        return [
            'http' => 0,
            'status' => 'warning',
            'message' => '接口检测失败，配置已保存；请刷新前台验证',
        ];
    }

    $code = (int) wp_remote_retrieve_response_code($response);
    if ($code === 200) {
        return ['http' => $code, 'status' => 'ok', 'message' => '接口正常，刷新前台即可（无需部署）'];
    }

    return [
        'http' => $code,
        'status' => 'warning',
        'message' => '接口 HTTP ' . $code . '；请硬刷新或 Purge 缓存',
    ];
}

function ybb_sm_audit_log_config_save(string $module, array $before, array $after): void
{
    if ($module === '' || $module === 'deploy') {
        return;
    }

    $labels = ybb_sm_audit_module_labels();
    $diff = ybb_sm_audit_diff_module($module, $before, $after);
    $verify = ybb_sm_audit_verify_rest($module);
    $diffLines = $diff['lines'] ?? explode("\n", (string) ($diff['detail'] ?? ''));
    $summary = ybb_sm_audit_build_summary(
        $module,
        $diffLines,
        $verify['message'] ?: '刷新 https://carp-ybb.com 查看'
    );

    ybb_sm_audit_append([
        'category' => 'config',
        'module' => $module,
        'moduleLabel' => $labels[$module] ?? $module,
        'action' => 'save',
        'status' => $verify['status'] === 'ok' ? 'success' : 'warning',
        'summary' => $summary,
        'detail' => $diff['detail'],
        'nextStep' => $verify['status'] === 'ok'
            ? '浏览器打开首页，Ctrl+Shift+R 硬刷新'
            : '若未生效：SiteGround → Purge Cache 后硬刷新',
        'meta' => ['deployRequired' => false, 'verifyHttp' => $verify['http']],
    ]);
}

function ybb_sm_audit_log_reset(string $module): void
{
    $labels = ybb_sm_audit_module_labels();
    ybb_sm_audit_append([
        'category' => 'config',
        'module' => $module,
        'moduleLabel' => $labels[$module] ?? $module,
        'action' => 'reset',
        'status' => 'success',
        'summary' => '已将【' . ($labels[$module] ?? $module) . '】恢复为默认',
        'detail' => '仅该模块恢复默认，其他模块未改动。',
        'nextStep' => '刷新 https://carp-ybb.com',
        'meta' => ['deployRequired' => false],
    ]);
}

function ybb_sm_audit_log_deploy_event(string $action, string $status, string $summary, array $meta = [], string $detail = '', string $nextStep = ''): void
{
    $actionLabels = ybb_sm_audit_action_labels();
    if ($nextStep === '' && $status === 'failed') {
        $nextStep = '查看「部署状态」或联系开发检�?Runner';
    }
    if ($nextStep === '' && $status === 'success') {
        $nextStep = '确认新产品页可访问；必要�?Purge 缓存';
    }

    ybb_sm_audit_append([
        'category' => 'deploy',
        'module' => 'deploy',
        'moduleLabel' => '站点部署',
        'action' => $action,
        'actionLabel' => $actionLabels[$action] ?? $action,
        'status' => $status,
        'summary' => $summary,
        'detail' => $detail,
        'nextStep' => $nextStep,
        'meta' => array_merge(['deployRequired' => true], $meta),
    ]);
}

function ybb_sm_audit_trigger_label(string $trigger): string
{
    $map = [
        'manual' => '管理员手动',
        'product_publish' => '产品首次发布',
        'product_update' => '产品更新',
    ];

    return $map[$trigger] ?? $trigger;
}

function ybb_sm_audit_friendly_error(string $error): string
{
    $error = trim($error);
    if (stripos($error, 'audit') !== false || stripos($error, 'BLOCKED') !== false) {
        return '部署包审计未通过，线上未被覆盖';
    }
    if (stripos($error, 'sync') !== false) {
        return '同步 Woo 产品失败';
    }
    if (stripos($error, 'build') !== false) {
        return '静态站构建失败';
    }
    if (stripos($error, 'upload') !== false || stripos($error, 'FTPS') !== false) {
        return '上传静态文件失败';
    }

    return $error !== '' ? mb_substr($error, 0, 200) : '未知错误';
}

add_action('update_option_' . YBB_SM_OPTION, function ($old, $new) {
    if (empty($GLOBALS['ybb_sm_audit_pending']) || !is_array($GLOBALS['ybb_sm_audit_pending'])) {
        return;
    }
    $pending = $GLOBALS['ybb_sm_audit_pending'];
    unset($GLOBALS['ybb_sm_audit_pending']);
    $module = sanitize_key($pending['module'] ?? '');
    if ($module === '') {
        return;
    }
    $before = is_array($pending['before'] ?? null) ? $pending['before'] : (is_array($old) ? $old : []);
    $after = is_array($new) ? $new : [];
    if ($module === 'deploy') {
        ybb_sm_audit_log_deploy_event('save', 'info', 'Deploy Secret 已更新', [], '密钥不明文记录。');
        return;
    }
    ybb_sm_audit_log_config_save($module, $before, $after);
}, 20, 2);

add_action('admin_post_ybb_sm_export_audit', function () {
    if (!current_user_can('manage_options')) {
        wp_die('Forbidden');
    }
    check_admin_referer('ybb_sm_export_audit');
    $result = ybb_sm_audit_query([
        'category' => sanitize_key($_GET['category'] ?? 'all'),
        'status' => sanitize_key($_GET['status'] ?? 'all'),
        'days' => max(0, (int) ($_GET['days'] ?? 30)),
        'page' => 1,
        'per_page' => YBB_SM_AUDIT_MAX_ENTRIES,
    ]);
    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename=ybb-audit-' . gmdate('Ymd-His') . '.csv');
    echo "\xEF\xBB\xBF";
    $out = fopen('php://output', 'w');
    fputcsv($out, ['时间', '操作人', '类别', '模块', '动作', '状态', '摘要', '详情', '下一步']);
    foreach ($result['items'] as $row) {
        fputcsv($out, [
            $row['at'] ?? '',
            $row['actor'] ?? '',
            $row['category'] ?? '',
            $row['moduleLabel'] ?? '',
            $row['actionLabel'] ?? '',
            $row['status'] ?? '',
            $row['summary'] ?? '',
            $row['detail'] ?? '',
            $row['nextStep'] ?? '',
        ]);
    }
    fclose($out);
    exit;
});
