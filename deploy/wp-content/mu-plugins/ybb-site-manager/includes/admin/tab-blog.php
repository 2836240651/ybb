<?php

if (!defined('ABSPATH')) {
    exit;
}

function ybb_sm_admin_blog_block_types(): array
{
    return [
        'paragraph' => '段落',
        'heading' => '小标题',
        'quote' => '引用',
        'image' => '图片',
        'mediaText' => '图文',
        'checklist' => '清单',
        'cta' => '行动按钮',
    ];
}

function ybb_sm_admin_blog_field_types(): array
{
    return [
        'text' => ['paragraph', 'heading', 'quote', 'mediaText', 'cta'],
        'level' => ['heading'],
        'caption' => ['quote', 'image'],
        'imageUrl' => ['image', 'mediaText'],
        'alt' => ['image', 'mediaText'],
        'width' => ['image'],
        'eyebrow' => ['mediaText'],
        'title' => ['mediaText', 'checklist', 'cta'],
        'imageSide' => ['mediaText'],
        'items' => ['checklist'],
        'buttonLabel' => ['cta'],
        'href' => ['cta'],
    ];
}

function ybb_sm_admin_blog_field_visible(string $field, string $type): bool
{
    $types = ybb_sm_admin_blog_field_types()[$field] ?? [];

    return in_array($type, $types, true);
}

function ybb_sm_admin_blog_field_class(string $field, string $type): string
{
    return 'ybb-blog-field' . (ybb_sm_admin_blog_field_visible($field, $type) ? '' : ' is-hidden');
}

function ybb_sm_admin_blog_preview_url(string $blogHandle, string $articleHandle): string
{
    $blogHandle = trim($blogHandle, '/');
    $articleHandle = trim($articleHandle, '/');

    return add_query_arg('_', (string) time(), home_url('/blogs/' . $blogHandle . '/' . $articleHandle));
}

function ybb_sm_admin_blog_list_url(array $args = []): string
{
    $base = [
        'page' => 'ybb-site-manager',
        'tab' => 'blog',
    ];

    return add_query_arg(array_merge($base, $args), admin_url('admin.php'));
}

function ybb_sm_admin_blog_edit_url(string $handle): string
{
    return ybb_sm_admin_blog_list_url(['article' => sanitize_title($handle)]);
}

function ybb_sm_admin_blog_filter_articles(array $articles): array
{
    $search = sanitize_text_field($_GET['blog_q'] ?? '');
    $filter = sanitize_key($_GET['blog_filter'] ?? 'all');

    $out = [];
    foreach ($articles as $i => $row) {
        if (!is_array($row)) {
            continue;
        }
        $title = (string) ($row['title'] ?? '');
        $handle = (string) ($row['handle'] ?? '');
        if ($search !== '') {
            $haystack = strtolower($title . ' ' . $handle);
            if (strpos($haystack, strtolower($search)) === false) {
                continue;
            }
        }
        if ($filter === 'featured' && empty($row['featuredOnHome'])) {
            continue;
        }
        if ($filter === 'hidden' && (!isset($row['enabled']) || !empty($row['enabled']))) {
            continue;
        }
        $out[] = ['index' => $i, 'row' => $row];
    }

    return $out;
}

function ybb_sm_admin_tab_blog_toolbar(): void
{
    $search = sanitize_text_field($_GET['blog_q'] ?? '');
    $filter = sanitize_key($_GET['blog_filter'] ?? 'all');
    ?>
    <form method="get" action="<?php echo esc_url(admin_url('admin.php')); ?>" class="ybb-blog-toolbar">
        <input type="hidden" name="page" value="ybb-site-manager" />
        <input type="hidden" name="tab" value="blog" />
        <input type="search" name="blog_q" value="<?php echo esc_attr($search); ?>" placeholder="搜索标题或 handle" class="regular-text" />
        <select name="blog_filter">
            <option value="all" <?php selected($filter, 'all'); ?>>全部文章</option>
            <option value="featured" <?php selected($filter, 'featured'); ?>>仅首页轮播</option>
            <option value="hidden" <?php selected($filter, 'hidden'); ?>>已隐藏</option>
        </select>
        <button type="submit" class="button">筛选</button>
        <?php if ($search !== '' || $filter !== 'all') : ?>
            <a class="button" href="<?php echo esc_url(ybb_sm_admin_blog_list_url()); ?>">清除</a>
        <?php endif; ?>
    </form>
    <?php
}

function ybb_sm_admin_tab_blog_router(string $opt, array $data): void
{
    $article = sanitize_title((string) ($_GET['article'] ?? ''));
    if ($article !== '') {
        ybb_sm_admin_tab_blog_edit($opt, $data, $article);

        return;
    }
    ybb_sm_admin_tab_blog_list($opt, $data);
}

function ybb_sm_admin_tab_blog_list(string $opt, array $data): void
{
    $filtered = ybb_sm_admin_blog_filter_articles($data['articles'] ?? []);
    $blogHandle = (string) ($data['handle'] ?? 'news');
    ?>
    <input type="hidden" name="ybb_sm_blog_save_mode" value="list" />

    <div class="ybb-blog-notice">
        文章正文通过 <code>GET /ybb/v1/site-manager/blog</code> 实时读取。<strong>已有文章</strong>保存后硬刷新前台即可生效，<strong>无需重新部署静态包</strong>。
        首页「最近更新 / Latest Stories」总开关在 <strong>首页模块</strong> Tab；此处「首页轮播」勾选决定轮播条目。
    </div>

    <p>
        <label><?php ybb_sm_admin_enabled_checkbox($opt . '[blog][enabled]', !empty($data['enabled'])); ?> 启用博客</label>
    </p>
    <table class="form-table">
        <tr>
            <th scope="row">URL handle</th>
            <td>
                <input type="text" class="regular-text" name="<?php echo esc_attr($opt); ?>[blog][handle]" value="<?php echo esc_attr($data['handle'] ?? 'news'); ?>" />
                <p class="description">列表路径 <code>/blogs/{handle}/</code></p>
            </td>
        </tr>
        <tr>
            <th scope="row">列表标题</th>
            <td><input type="text" class="large-text" name="<?php echo esc_attr($opt); ?>[blog][title]" value="<?php echo esc_attr($data['title'] ?? ''); ?>" /></td>
        </tr>
        <tr>
            <th scope="row">列表描述</th>
            <td><textarea name="<?php echo esc_attr($opt); ?>[blog][description]" rows="2" class="large-text"><?php echo esc_textarea($data['description'] ?? ''); ?></textarea></td>
        </tr>
    </table>

    <h2>文章列表</h2>
    <table class="widefat striped">
        <thead>
            <tr>
                <th style="width:56px;">封面</th>
                <th>标题</th>
                <th style="width:100px;">日期</th>
                <th style="width:70px;">显示</th>
                <th style="width:90px;">首页轮播</th>
                <th style="width:160px;">操作</th>
            </tr>
        </thead>
        <tbody>
        <?php foreach ($filtered as $entry) :
            $i = (int) $entry['index'];
            $row = $entry['row'];
            $handle = (string) ($row['handle'] ?? '');
            $imageUrl = (string) ($row['imageUrl'] ?? '');
            $thumb = $imageUrl !== '' ? esc_url($imageUrl) : '';
            ?>
            <tr>
                <td>
                    <?php if ($thumb !== '') : ?>
                        <img src="<?php echo $thumb; ?>" alt="" class="ybb-blog-list-thumb" />
                    <?php else : ?>
                        <span class="ybb-blog-list-thumb" aria-hidden="true"></span>
                    <?php endif; ?>
                </td>
                <td>
                    <strong><?php echo esc_html($row['title'] ?? 'Untitled'); ?></strong><br />
                    <code><?php echo esc_html($handle); ?></code>
                    <input type="hidden" name="<?php echo esc_attr($opt); ?>[blog][articles][<?php echo $i; ?>][id]" value="<?php echo esc_attr($row['id'] ?? ''); ?>" />
                    <input type="hidden" name="<?php echo esc_attr($opt); ?>[blog][articles][<?php echo $i; ?>][handle]" value="<?php echo esc_attr($handle); ?>" />
                </td>
                <td><?php echo esc_html($row['publishedAt'] ?? ''); ?></td>
                <td><?php ybb_sm_admin_enabled_checkbox($opt . '[blog][articles][' . $i . '][enabled]', !isset($row['enabled']) || !empty($row['enabled'])); ?></td>
                <td><?php ybb_sm_admin_enabled_checkbox($opt . '[blog][articles][' . $i . '][featuredOnHome]', !empty($row['featuredOnHome'])); ?></td>
                <td>
                    <a class="button button-small" href="<?php echo esc_url(ybb_sm_admin_blog_edit_url($handle)); ?>">编辑</a>
                    <a class="button button-small" href="<?php echo esc_url(ybb_sm_admin_blog_preview_url($blogHandle, $handle)); ?>" target="_blank" rel="noopener">预览</a>
                </td>
            </tr>
        <?php endforeach; ?>
        </tbody>
    </table>
    <?php if ($filtered === []) : ?>
        <p class="description">没有匹配的文章。请调整搜索或筛选条件。</p>
    <?php endif; ?>
    <?php
}

function ybb_sm_admin_tab_blog_edit(string $opt, array $data, string $editHandle): void
{
    $article = null;
    foreach ($data['articles'] ?? [] as $row) {
        if (!is_array($row)) {
            continue;
        }
        if (sanitize_title((string) ($row['handle'] ?? '')) === $editHandle) {
            $article = $row;
            break;
        }
    }
    if ($article === null) {
        echo '<div class="notice notice-error"><p>未找到文章 handle：<code>' . esc_html($editHandle) . '</code></p></div>';
        echo '<p><a class="button" href="' . esc_url(ybb_sm_admin_blog_list_url()) . '">返回文章列表</a></p>';

        return;
    }

    $blogHandle = (string) ($data['handle'] ?? 'news');
    $handle = (string) ($article['handle'] ?? $editHandle);
    $blocks = $article['contentBlocks'] ?? [];
    $hasBlocks = $blocks !== [];
    $legacyText = implode("\n\n", (array) ($article['content'] ?? []));
    $base = $opt . '[blog][article]';
    ?>
    <input type="hidden" name="ybb_sm_blog_save_mode" value="article" />
    <input type="hidden" name="ybb_sm_blog_edit_handle" value="<?php echo esc_attr($editHandle); ?>" />

    <div class="ybb-blog-edit-header">
        <a class="button" href="<?php echo esc_url(ybb_sm_admin_blog_list_url()); ?>">&larr; 返回文章列表</a>
        <a class="button" href="<?php echo esc_url(ybb_sm_admin_blog_preview_url($blogHandle, $handle)); ?>" target="_blank" rel="noopener">预览前台</a>
    </div>

    <div class="ybb-blog-notice">
        保存后请<strong>硬刷新</strong>前台文章页查看效果（Ctrl+F5）。已有 handle <strong>无需重新部署静态包</strong>。
        若修改 URL handle 为新地址，需联系技术执行静态站部署后 URL 才可访问。
    </div>

    <h2><?php echo esc_html($article['title'] ?? '编辑文章'); ?></h2>
    <p>
        <label><?php ybb_sm_admin_enabled_checkbox($base . '[enabled]', !isset($article['enabled']) || !empty($article['enabled'])); ?> 显示</label>
        <label style="margin-left:16px;"><?php ybb_sm_admin_enabled_checkbox($base . '[featuredOnHome]', !empty($article['featuredOnHome'])); ?> 首页轮播</label>
        <input type="hidden" name="<?php echo esc_attr($base); ?>[id]" value="<?php echo esc_attr($article['id'] ?? ''); ?>" />
    </p>

    <table class="form-table">
        <tr>
            <th scope="row">URL handle</th>
            <td><input type="text" class="regular-text" name="<?php echo esc_attr($base); ?>[handle]" value="<?php echo esc_attr($handle); ?>" /></td>
        </tr>
        <tr>
            <th scope="row">标题</th>
            <td><input type="text" class="large-text" name="<?php echo esc_attr($base); ?>[title]" value="<?php echo esc_attr($article['title'] ?? ''); ?>" /></td>
        </tr>
        <tr>
            <th scope="row">摘要</th>
            <td><textarea name="<?php echo esc_attr($base); ?>[excerpt]" rows="3" class="large-text"><?php echo esc_textarea($article['excerpt'] ?? ''); ?></textarea></td>
        </tr>
        <tr>
            <th scope="row">日期 / 作者</th>
            <td>
                <input type="date" name="<?php echo esc_attr($base); ?>[publishedAt]" value="<?php echo esc_attr($article['publishedAt'] ?? ''); ?>" />
                <input type="text" name="<?php echo esc_attr($base); ?>[author]" value="<?php echo esc_attr($article['author'] ?? ''); ?>" placeholder="作者" class="regular-text" style="margin-left:8px;" />
            </td>
        </tr>
        <tr>
            <th scope="row">封面图</th>
            <td>
                <input type="text" class="large-text ybb-sm-image" id="blog-cover-img" name="<?php echo esc_attr($base); ?>[imageUrl]" value="<?php echo esc_attr($article['imageUrl'] ?? ''); ?>" />
                <button type="button" class="button ybb-sm-pick-image" data-target="#blog-cover-img">选择图片</button>
                <span class="ybb-sm-thumb-wrap"></span>
            </td>
        </tr>
    </table>

    <h3>正文内容块</h3>
    <div class="ybb-blog-blocks-toolbar">
        <span>添加内容块：</span>
        <?php foreach (ybb_sm_admin_blog_block_types() as $type => $label) : ?>
            <button type="button" class="button button-small ybb-blog-add-block" data-block-type="<?php echo esc_attr($type); ?>"><?php echo esc_html($label); ?></button>
        <?php endforeach; ?>
    </div>

    <div id="ybb-blog-blocks-list">
        <?php foreach ($blocks as $bi => $block) {
            ybb_sm_admin_blog_block_fields($base, (int) $bi, is_array($block) ? $block : []);
        } ?>
    </div>

    <?php if (!$hasBlocks && $legacyText !== '') : ?>
        <div id="ybb-blog-legacy-panel" class="ybb-blog-legacy-panel">
            <p>此文章仍使用旧版段落正文。可一键导入为「段落」内容块后继续用块编辑器维护。</p>
            <textarea id="ybb-blog-legacy-content" class="large-text" rows="4" readonly><?php echo esc_textarea($legacyText); ?></textarea>
            <p>
                <button type="button" class="button ybb-blog-import-legacy">将旧版段落导入为内容块</button>
            </p>
            <p class="description">导入后请保存；前台将优先渲染内容块。</p>
        </div>
        <input type="hidden" name="<?php echo esc_attr($base); ?>[contentText]" value="<?php echo esc_attr($legacyText); ?>" />
    <?php endif; ?>

    <script type="text/html" id="ybb-blog-block-template">
        <?php ybb_sm_admin_blog_block_fields($base, '__INDEX__', [
            'id' => '__BLOCK_ID__',
            'type' => '__BLOCK_TYPE__',
            'enabled' => true,
            'sortOrder' => 1,
        ], true); ?>
    </script>
    <?php
}

/** @param int|string $blockIndex */
function ybb_sm_admin_blog_block_fields(string $articleBase, $blockIndex, array $block, bool $isTemplate = false): void
{
    $base = $articleBase . '[contentBlocks][' . $blockIndex . ']';
    $type = (string) ($block['type'] ?? 'paragraph');
    $typeLabels = ybb_sm_admin_blog_block_types();
    $typeLabel = $typeLabels[$type] ?? $type;
    $imgId = $isTemplate ? 'blog-block-img-__INDEX__' : 'blog-block-img-' . $blockIndex;
    $orderLabel = $isTemplate ? '1' : (string) ($block['sortOrder'] ?? ((is_numeric($blockIndex) ? (int) $blockIndex : 0) + 1));
    $itemsText = implode("\n", (array) ($block['items'] ?? []));
    ?>
    <div class="ybb-blog-block" data-ybb-blog-block data-active-type="<?php echo esc_attr($type); ?>">
        <div class="ybb-blog-block-head">
            <span>块 <span class="ybb-blog-block-order"><?php echo esc_html($orderLabel); ?></span></span>
            <span class="ybb-blog-block-type-label"><?php echo esc_html($typeLabel); ?></span>
            <input type="hidden" name="<?php echo esc_attr($base); ?>[id]" value="<?php echo esc_attr($block['id'] ?? ('block-' . ($blockIndex + 1))); ?>" />
            <input type="hidden" name="<?php echo esc_attr($base); ?>[enabled]" value="1" />
            <input type="hidden" name="<?php echo esc_attr($base); ?>[sortOrder]" data-ybb-sort-order value="<?php echo esc_attr((string) ($block['sortOrder'] ?? ($blockIndex + 1))); ?>" />
            <label>
                类型
                <select name="<?php echo esc_attr($base); ?>[type]" data-ybb-block-type>
                    <?php foreach ($typeLabels as $candidate => $label) : ?>
                        <option value="<?php echo esc_attr($candidate); ?>" <?php selected($type, $candidate); ?>><?php echo esc_html($label); ?></option>
                    <?php endforeach; ?>
                </select>
            </label>
            <button type="button" class="button button-small ybb-blog-move-block-up">上移</button>
            <button type="button" class="button button-small ybb-blog-move-block-down">下移</button>
            <button type="button" class="button button-small ybb-blog-remove-block">删除</button>
        </div>

        <div class="<?php echo esc_attr(ybb_sm_admin_blog_field_class('text', $type)); ?>" data-ybb-field="text">
            <label><?php echo $type === 'heading' ? '标题文字' : '正文'; ?><br />
                <textarea class="large-text" rows="4" name="<?php echo esc_attr($base); ?>[text]"><?php echo esc_textarea($block['text'] ?? ''); ?></textarea>
            </label>
            <?php if ($type === 'paragraph' || $type === 'quote' || $type === 'mediaText') : ?>
            <p class="description">多段请用空行分隔。</p>
            <?php endif; ?>
        </div>

        <div class="<?php echo esc_attr(ybb_sm_admin_blog_field_class('level', $type)); ?>" data-ybb-field="level">
            <label>标题级别
                <select name="<?php echo esc_attr($base); ?>[level]">
                    <option value="h2" <?php selected($block['level'] ?? 'h2', 'h2'); ?>>H2</option>
                    <option value="h3" <?php selected($block['level'] ?? 'h2', 'h3'); ?>>H3</option>
                </select>
            </label>
        </div>

        <div class="<?php echo esc_attr(ybb_sm_admin_blog_field_class('caption', $type)); ?>" data-ybb-field="caption">
            <label>说明文字<br />
                <input type="text" class="large-text" name="<?php echo esc_attr($base); ?>[caption]" value="<?php echo esc_attr($block['caption'] ?? ''); ?>" />
            </label>
        </div>

        <div class="<?php echo esc_attr(ybb_sm_admin_blog_field_class('imageUrl', $type)); ?>" data-ybb-field="imageUrl">
            <label>图片 URL<br />
                <input type="text" class="large-text ybb-sm-image" id="<?php echo esc_attr($imgId); ?>" name="<?php echo esc_attr($base); ?>[imageUrl]" value="<?php echo esc_attr($block['imageUrl'] ?? ''); ?>" />
            </label>
            <button type="button" class="button ybb-sm-pick-image" data-target="#<?php echo esc_attr($imgId); ?>">选择图片</button>
            <span class="ybb-sm-thumb-wrap"></span>
        </div>

        <div class="<?php echo esc_attr(ybb_sm_admin_blog_field_class('alt', $type)); ?>" data-ybb-field="alt">
            <label>图片 Alt<br />
                <input type="text" class="regular-text" name="<?php echo esc_attr($base); ?>[alt]" value="<?php echo esc_attr($block['alt'] ?? ''); ?>" />
            </label>
        </div>

        <div class="<?php echo esc_attr(ybb_sm_admin_blog_field_class('width', $type)); ?>" data-ybb-field="width">
            <label>图片宽度
                <select name="<?php echo esc_attr($base); ?>[width]">
                    <option value="wide" <?php selected($block['width'] ?? 'wide', 'wide'); ?>>宽图</option>
                    <option value="prose" <?php selected($block['width'] ?? 'wide', 'prose'); ?>>正文宽</option>
                </select>
            </label>
        </div>

        <div class="<?php echo esc_attr(ybb_sm_admin_blog_field_class('eyebrow', $type)); ?>" data-ybb-field="eyebrow">
            <label>眉题<br />
                <input type="text" class="regular-text" name="<?php echo esc_attr($base); ?>[eyebrow]" value="<?php echo esc_attr($block['eyebrow'] ?? ''); ?>" />
            </label>
        </div>

        <div class="<?php echo esc_attr(ybb_sm_admin_blog_field_class('title', $type)); ?>" data-ybb-field="title">
            <label>块标题<br />
                <input type="text" class="large-text" name="<?php echo esc_attr($base); ?>[title]" value="<?php echo esc_attr($block['title'] ?? ''); ?>" />
            </label>
        </div>

        <div class="<?php echo esc_attr(ybb_sm_admin_blog_field_class('imageSide', $type)); ?>" data-ybb-field="imageSide">
            <label>图片位置
                <select name="<?php echo esc_attr($base); ?>[imageSide]">
                    <option value="left" <?php selected($block['imageSide'] ?? 'left', 'left'); ?>>左侧</option>
                    <option value="right" <?php selected($block['imageSide'] ?? 'left', 'right'); ?>>右侧</option>
                </select>
            </label>
        </div>

        <div class="<?php echo esc_attr(ybb_sm_admin_blog_field_class('items', $type)); ?>" data-ybb-field="items">
            <label>清单条目（每行一条）<br />
                <textarea class="large-text" rows="4" name="<?php echo esc_attr($base); ?>[items]"><?php echo esc_textarea($itemsText); ?></textarea>
            </label>
        </div>

        <div class="<?php echo esc_attr(ybb_sm_admin_blog_field_class('buttonLabel', $type)); ?>" data-ybb-field="buttonLabel">
            <label>按钮文字<br />
                <input type="text" class="regular-text" name="<?php echo esc_attr($base); ?>[buttonLabel]" value="<?php echo esc_attr($block['buttonLabel'] ?? ''); ?>" />
            </label>
        </div>

        <div class="<?php echo esc_attr(ybb_sm_admin_blog_field_class('href', $type)); ?>" data-ybb-field="href">
            <label>按钮链接<br />
                <input type="text" class="regular-text" name="<?php echo esc_attr($base); ?>[href]" value="<?php echo esc_attr($block['href'] ?? ''); ?>" />
            </label>
        </div>
    </div>
    <?php
}
