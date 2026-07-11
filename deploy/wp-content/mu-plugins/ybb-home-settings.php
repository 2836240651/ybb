<?php
/**
 * Plugin Name: YBB Home Settings
 * Description: Homepage section toggles + Latest Stories carousel for static frontend.
 * Version: 1.3.1
 */

if (!defined('ABSPATH')) {
    exit;
}

const YBB_HOME_OPTION = 'ybb_home_settings';

function ybb_home_default_latest_stories(): array
{
    return [
        [
            'id' => 'story-1',
            'handle' => '2026-catalog-launch',
            'title' => '2026 Wholesale Catalog Now Available',
            'excerpt' => 'Over 200 new SKUs across terminal tackle and bait care �?request your B2B catalog today.',
            'publishedAt' => '2026-01-10',
            'imageUrl' => '/products/stand-wrench/master.webp',
            'articleUrl' => '/blogs/news/2026-catalog-launch',
            'enabled' => true,
        ],
        [
            'id' => 'story-2',
            'handle' => 'oem-packaging-guide',
            'title' => 'OEM Packaging: What Overseas Buyers Should Know',
            'excerpt' => 'A practical guide to blister cards, hang tags, and retail-ready cartons for private-label programs.',
            'publishedAt' => '2025-11-22',
            'imageUrl' => '/products/rod-rack-wall-mount/master.webp',
            'articleUrl' => '/blogs/news/oem-packaging-guide',
            'enabled' => true,
        ],
        [
            'id' => 'story-3',
            'handle' => 'method-feeder-trends',
            'title' => 'Method Feeder Trends for European Markets',
            'excerpt' => 'How carp anglers are driving demand for inline and cage feeder variants �?and what wholesalers should stock.',
            'publishedAt' => '2025-10-05',
            'imageUrl' => '/products/braided-line-bait-cage-rig-balance/master.webp',
            'articleUrl' => '/blogs/news/method-feeder-trends',
            'enabled' => true,
        ],
        [
            'id' => 'story-4',
            'handle' => 'quality-audit-checklist',
            'title' => 'Pre-Shipment Quality: Our Audit Checklist',
            'excerpt' => 'What happens between final assembly and the export carton �?transparency for B2B partners.',
            'publishedAt' => '2025-08-18',
            'imageUrl' => '/products/tz-qz-025/master.webp',
            'articleUrl' => '/blogs/news/quality-audit-checklist',
            'enabled' => true,
        ],
        [
            'id' => 'story-5',
            'handle' => 'mixed-carton-efficiency',
            'title' => 'Why Mixed-Carton Wholesale Saves Margin',
            'excerpt' => 'Consolidating SKUs at the factory reduces freight and handling for tackle shops and distributors.',
            'publishedAt' => '2025-06-30',
            'imageUrl' => '/products/tz-dg-001/master.webp',
            'articleUrl' => '/blogs/news/mixed-carton-efficiency',
            'enabled' => true,
        ],
    ];
}

function ybb_home_default_hot_products(): array
{
    $handles = [
        'tz-qz-025',
        'tz-qz-024',
        'tz-qz-026',
        'tz-qz-023',
        'tz-qz-022',
        'tz-qz-021',
    ];
    $out = [];
    foreach ($handles as $index => $handle) {
        $out[] = [
            'id' => 'hot-' . ($index + 1),
            'handle' => $handle,
            'titleOverride' => '',
            'imageUrl' => '',
            'enabled' => true,
        ];
    }

    return $out;
}

function ybb_home_settings_defaults(): array
{
    return [
        'wholesaleCollectionsEnabled' => true,
        'latestStoriesEnabled' => true,
        'latestStories' => ybb_home_default_latest_stories(),
        'hotProductsEnabled' => true,
        'hotProductsAutoplayMs' => 4000,
        'hotProducts' => ybb_home_default_hot_products(),
    ];
}

function ybb_home_sanitize_story_row($row, int $index): array
{
    $row = is_array($row) ? $row : [];
    $handle = sanitize_title($row['handle'] ?? ('story-' . ($index + 1)));
    if ($handle === '') {
        $handle = 'story-' . ($index + 1);
    }

    $image = trim((string) ($row['imageUrl'] ?? ''));
    if ($image !== '' && !preg_match('#^https?://#i', $image)) {
        $image = '/' . ltrim($image, '/');
    }

    $article = trim((string) ($row['articleUrl'] ?? ''));
    if ($article !== '' && !preg_match('#^https?://#i', $article)) {
        $article = '/' . ltrim($article, '/');
    }

    $date = trim((string) ($row['publishedAt'] ?? ''));
    if ($date !== '' && !preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
        $date = gmdate('Y-m-d');
    }

    return [
        'id' => sanitize_key($row['id'] ?? ('story-' . wp_generate_password(6, false, false))),
        'handle' => $handle,
        'title' => sanitize_text_field($row['title'] ?? ''),
        'excerpt' => sanitize_textarea_field($row['excerpt'] ?? ''),
        'publishedAt' => $date,
        'imageUrl' => $image === '' ? '' : esc_url_raw($image, ['http', 'https']),
        'articleUrl' => $article === '' ? '' : esc_url_raw($article, ['http', 'https']),
        'enabled' => !empty($row['enabled']),
    ];
}

function ybb_home_sanitize_hot_product_row($row, int $index): array
{
    $row = is_array($row) ? $row : [];
    $handle = sanitize_title($row['handle'] ?? ('product-' . ($index + 1)));
    if ($handle === '') {
        $handle = 'product-' . ($index + 1);
    }

    $image = trim((string) ($row['imageUrl'] ?? ''));
    if ($image !== '' && !preg_match('#^https?://#i', $image)) {
        $image = '/' . ltrim($image, '/');
    }

    return [
        'id' => sanitize_key($row['id'] ?? ('hot-' . wp_generate_password(6, false, false))),
        'handle' => $handle,
        'titleOverride' => sanitize_text_field($row['titleOverride'] ?? ''),
        'imageUrl' => $image === '' ? '' : esc_url_raw($image, ['http', 'https']),
        'enabled' => !empty($row['enabled']),
    ];
}

function ybb_home_settings_sanitize($input): array
{
    $input = is_array($input) ? $input : [];
    $defaults = ybb_home_settings_defaults();
    $existing = get_option(YBB_HOME_OPTION, []);
    if (!is_array($existing)) {
        $existing = [];
    }

    $stories = [];
    if (isset($input['latestStories']) && is_array($input['latestStories'])) {
        foreach (array_values($input['latestStories']) as $index => $row) {
            $story = ybb_home_sanitize_story_row($row, $index);
            if ($story['title'] === '' && $story['excerpt'] === '' && $story['imageUrl'] === '') {
                continue;
            }
            $stories[] = $story;
        }
    } elseif (!empty($existing['latestStories']) && is_array($existing['latestStories'])) {
        foreach (array_values($existing['latestStories']) as $index => $row) {
            $stories[] = ybb_home_sanitize_story_row($row, $index);
        }
    }

    if (empty($stories)) {
        $stories = $defaults['latestStories'];
    }

    $hotProducts = [];
    if (isset($input['hotProducts']) && is_array($input['hotProducts'])) {
        foreach (array_values($input['hotProducts']) as $index => $row) {
            $product = ybb_home_sanitize_hot_product_row($row, $index);
            if ($product['handle'] === '') {
                continue;
            }
            $hotProducts[] = $product;
        }
    } elseif (!empty($existing['hotProducts']) && is_array($existing['hotProducts'])) {
        foreach (array_values($existing['hotProducts']) as $index => $row) {
            $hotProducts[] = ybb_home_sanitize_hot_product_row($row, $index);
        }
    }

    if (empty($hotProducts)) {
        $hotProducts = $defaults['hotProducts'];
    }

    $autoplayMs = isset($input['hotProductsAutoplayMs'])
        ? (int) $input['hotProductsAutoplayMs']
        : (int) $defaults['hotProductsAutoplayMs'];
    if ($autoplayMs < 2000) {
        $autoplayMs = 2000;
    }
    if ($autoplayMs > 15000) {
        $autoplayMs = 15000;
    }

    return [
        'wholesaleCollectionsEnabled' => !empty($input['wholesaleCollectionsEnabled']),
        'latestStoriesEnabled' => !empty($input['latestStoriesEnabled']),
        'latestStories' => $stories,
        'hotProductsEnabled' => !empty($input['hotProductsEnabled']),
        'hotProductsAutoplayMs' => $autoplayMs,
        'hotProducts' => $hotProducts,
    ];
}

/** Site Manager home module overrides legacy option when present. */
function ybb_home_resolved_settings(): array
{
    if (function_exists('ybb_sm_home_get_settings')) {
        return ybb_sm_home_get_settings();
    }

    return ybb_home_settings_get();
}

function ybb_home_settings_get(): array
{
    $stored = get_option(YBB_HOME_OPTION, []);
    if (!is_array($stored)) {
        $stored = [];
    }

    $defaults = ybb_home_settings_defaults();
    $merged = array_replace($defaults, $stored);
    if (empty($merged['latestStories']) || !is_array($merged['latestStories'])) {
        $merged['latestStories'] = $defaults['latestStories'];
    }
    if (empty($merged['hotProducts']) || !is_array($merged['hotProducts'])) {
        $merged['hotProducts'] = $defaults['hotProducts'];
    }

    $autoplayMs = isset($merged['hotProductsAutoplayMs'])
        ? (int) $merged['hotProductsAutoplayMs']
        : (int) $defaults['hotProductsAutoplayMs'];
    if ($autoplayMs < 2000) {
        $autoplayMs = 2000;
    }

    return [
        'wholesaleCollectionsEnabled' => !empty($merged['wholesaleCollectionsEnabled']),
        'latestStoriesEnabled' => !empty($merged['latestStoriesEnabled']),
        'latestStories' => array_values($merged['latestStories']),
        'hotProductsEnabled' => !empty($merged['hotProductsEnabled']),
        'hotProductsAutoplayMs' => $autoplayMs,
        'hotProducts' => array_values($merged['hotProducts']),
        'source' => 'wordpress',
        'syncedAt' => gmdate('c'),
    ];
}

function ybb_home_latest_stories_public(): array
{
    $settings = ybb_home_resolved_settings();
    if (empty($settings['latestStoriesEnabled'])) {
        return [];
    }

    $site = home_url('/');
    $out = [];

    foreach ($settings['latestStories'] as $story) {
        if (empty($story['enabled']) || empty($story['title'])) {
            continue;
        }

        $image = (string) ($story['imageUrl'] ?? '');
        if ($image !== '' && !preg_match('#^https?://#i', $image)) {
            $image = home_url($image);
        }
        if ($image !== '' && substr($image, 0, 7) === 'http://') {
            $image = 'https://' . substr($image, 7);
        }

        $href = (string) ($story['articleUrl'] ?? '');
        if ($href === '') {
            $href = home_url('/blogs/news/' . ($story['handle'] ?? ''));
        } elseif (!preg_match('#^https?://#i', $href)) {
            $href = home_url($href);
        }

        $out[] = [
            'handle' => (string) ($story['handle'] ?? ''),
            'title' => (string) ($story['title'] ?? ''),
            'excerpt' => (string) ($story['excerpt'] ?? ''),
            'publishedAt' => (string) ($story['publishedAt'] ?? ''),
            'image' => $image,
            'href' => $href,
        ];
    }

    return $out;
}

function ybb_home_wc_find_product_by_handle(string $handle): ?WC_Product
{
    if (!function_exists('wc_get_products')) {
        return null;
    }

    $sku = strtoupper($handle);
    $ids = wc_get_products([
        'status' => 'publish',
        'sku' => $sku,
        'limit' => 1,
        'return' => 'ids',
    ]);
    if ($ids) {
        $product = wc_get_product($ids[0]);
        if ($product instanceof WC_Product) {
            if ($product->get_type() === 'variation' && $product->get_parent_id()) {
                $parent = wc_get_product($product->get_parent_id());
                return $parent instanceof WC_Product ? $parent : $product;
            }

            return $product;
        }
    }

    $posts = get_posts([
        'post_type' => 'product',
        'name' => $handle,
        'posts_per_page' => 1,
        'post_status' => 'publish',
    ]);
    if ($posts) {
        $product = wc_get_product($posts[0]->ID);
        return $product instanceof WC_Product ? $product : null;
    }

    return null;
}

function ybb_home_product_image_url(string $handle, ?WC_Product $product = null, string $override = ''): string
{
    if ($override !== '') {
        if (!preg_match('#^https?://#i', $override)) {
            return home_url($override);
        }

        return $override;
    }

    if ($product instanceof WC_Product) {
        $imageId = $product->get_image_id();
        if ($imageId) {
            $url = wp_get_attachment_image_url($imageId, 'woocommerce_thumbnail');
            if ($url) {
                return $url;
            }
        }
    }

    return home_url('/products/' . $handle . '/master.webp');
}

function ybb_home_hot_products_public(): array
{
    $settings = ybb_home_resolved_settings();
    if (empty($settings['hotProductsEnabled'])) {
        return [];
    }

    $out = [];
    foreach ($settings['hotProducts'] as $row) {
        if (empty($row['enabled']) || empty($row['handle'])) {
            continue;
        }

        $handle = (string) $row['handle'];
        $wcProduct = ybb_home_wc_find_product_by_handle($handle);
        $titleOverride = trim((string) ($row['titleOverride'] ?? ''));
        $title = $titleOverride;
        if ($title === '' && $wcProduct instanceof WC_Product) {
            $title = $wcProduct->get_name();
        }
        if ($title === '') {
            $title = $handle;
        }

        $price = 0.0;
        $compareAt = null;
        $available = true;
        if ($wcProduct instanceof WC_Product) {
            $price = (float) $wcProduct->get_price();
            $regular = (float) $wcProduct->get_regular_price();
            $sale = (float) $wcProduct->get_sale_price();
            if ($sale > 0 && $regular > $sale) {
                $price = $sale;
                $compareAt = $regular;
            } elseif ($regular > 0) {
                $price = $regular;
            }
            $available = $wcProduct->is_in_stock();
        }

        $image = ybb_home_product_image_url(
            $handle,
            $wcProduct,
            (string) ($row['imageUrl'] ?? '')
        );
        if ($image !== '' && substr($image, 0, 7) === 'http://') {
            $image = 'https://' . substr($image, 7);
        }

        $out[] = [
            'handle' => $handle,
            'title' => $title,
            'price' => $price,
            'compareAtPrice' => $compareAt,
            'image' => $image,
            'href' => home_url('/products/' . $handle),
            'available' => $available,
        ];
    }

    return $out;
}

add_action('admin_init', function () {
    register_setting('ybb_home_settings_group', YBB_HOME_OPTION, [
        'type' => 'array',
        'sanitize_callback' => 'ybb_home_settings_sanitize',
        'default' => ybb_home_settings_defaults(),
    ]);
});

add_action('admin_enqueue_scripts', function ($hook) {
    if ($hook !== 'settings_page_ybb-home-settings') {
        return;
    }

    wp_enqueue_media();
    wp_register_script('ybb-home-settings-admin', false, ['jquery'], '1.3.0', true);
    wp_enqueue_script('ybb-home-settings-admin');
    wp_add_inline_script('ybb-home-settings-admin', 'window.ybbHomeOptionName = ' . wp_json_encode(YBB_HOME_OPTION) . ';');
    wp_add_inline_script('ybb-home-settings-admin', <<<'JS'
jQuery(function ($) {
  const optionName = window.ybbHomeOptionName || 'ybb_home_settings';

  function bindPicker() {
    $('.ybb-pick-image').off('click').on('click', function (e) {
      e.preventDefault();
      const $input = $(this).closest('td').find('.ybb-image-url');
      const frame = wp.media({
        title: '选择 Latest Stories 配图',
        button: { text: '使用此图片' },
        multiple: false
      });
      frame.on('select', function () {
        const attachment = frame.state().get('selection').first().toJSON();
        $input.val(attachment.url || '');
      });
      frame.open();
    });
  }

  $('#ybb-add-story').on('click', function (e) {
    e.preventDefault();
    const $tbody = $('#ybb-stories-table tbody');
    const index = $tbody.find('tr').length;
    const id = 'story-' + Date.now();
    const row = `
      <tr class="ybb-story-row">
        <td><input type="checkbox" name="${optionName}[latestStories][${index}][enabled]" value="1" checked /></td>
        <td><input type="hidden" name="${optionName}[latestStories][${index}][id]" value="${id}" />
          <input type="text" class="regular-text" name="${optionName}[latestStories][${index}][title]" value="" placeholder="标题" /></td>
        <td><textarea class="large-text" rows="2" name="${optionName}[latestStories][${index}][excerpt]" placeholder="摘要"></textarea></td>
        <td><input type="date" name="${optionName}[latestStories][${index}][publishedAt]" value="" /></td>
        <td><div class="ybb-image-field"><input type="text" class="large-text ybb-image-url" name="${optionName}[latestStories][${index}][imageUrl]" value="" placeholder="/products/... 或媒体库 URL" />
          <button type="button" class="button ybb-pick-image">选图</button></div></td>
        <td><input type="text" class="regular-text" name="${optionName}[latestStories][${index}][handle]" value="" placeholder="url-slug" />
          <input type="text" class="large-text" name="${optionName}[latestStories][${index}][articleUrl]" value="" placeholder="/blogs/news/slug" /></td>
        <td><button type="button" class="button ybb-remove-story">删除</button></td>
      </tr>`;
    $tbody.append(row);
    bindPicker();
  });

  $(document).on('click', '.ybb-remove-story', function (e) {
    e.preventDefault();
    $(this).closest('tr').remove();
  });

  $('#ybb-add-hot-product').on('click', function (e) {
    e.preventDefault();
    const $tbody = $('#ybb-hot-products-table tbody');
    const index = $tbody.find('tr').length;
    const id = 'hot-' + Date.now();
    const row = `
      <tr class="ybb-hot-row">
        <td><input type="checkbox" name="${optionName}[hotProducts][${index}][enabled]" value="1" checked /></td>
        <td><input type="hidden" name="${optionName}[hotProducts][${index}][id]" value="${id}" />
          <input type="text" class="regular-text" name="${optionName}[hotProducts][${index}][handle]" value="" placeholder="产品 slug，如 tz-qz-025" /></td>
        <td><input type="text" class="large-text" name="${optionName}[hotProducts][${index}][titleOverride]" value="" placeholder="留空则用 Woo 标题" /></td>
        <td><div class="ybb-image-field"><input type="text" class="large-text ybb-image-url" name="${optionName}[hotProducts][${index}][imageUrl]" value="" placeholder="/products/... 或媒体库 URL" />
          <button type="button" class="button ybb-pick-image">选图</button></div></td>
        <td><button type="button" class="button ybb-remove-hot-product">删除</button></td>
      </tr>`;
    $tbody.append(row);
    bindPicker();
  });

  $(document).on('click', '.ybb-remove-hot-product', function (e) {
    e.preventDefault();
    $(this).closest('tr').remove();
  });

  bindPicker();
});
JS
    );
});

add_action('admin_menu', function () {
    add_options_page(
        'YBB Home Settings',
        'YBB Home Settings',
        'manage_options',
        'ybb-home-settings',
        'ybb_home_settings_render_settings_page'
    );
});

function ybb_home_settings_render_settings_page(): void
{
    if (!current_user_can('manage_options')) {
        return;
    }

    $settings = ybb_home_settings_get();
    $stories = $settings['latestStories'];
    $hotProducts = $settings['hotProducts'];
    ?>
    <div class="wrap ybb-home-settings">
        <h1>YBB Home Settings</h1>
        <p>首页模块配置会同步到静态前�?REST API。Latest Stories 保存后前台会自动读取，无需重新上传静态包�?/p>

        <form method="post" action="options.php">
            <?php settings_fields('ybb_home_settings_group'); ?>

            <h2 class="title">模块开�?/h2>
            <table class="form-table" role="presentation">
                <tr>
                    <th scope="row">Wholesale collections</th>
                    <td>
                        <label>
                            <input type="checkbox"
                                   name="<?php echo esc_attr(YBB_HOME_OPTION); ?>[wholesaleCollectionsEnabled]"
                                   value="1" <?php checked(!empty($settings['wholesaleCollectionsEnabled'])); ?> />
                            在首页显示「Wholesale collections�?2 类目轮播
                        </label>
                    </td>
                </tr>
                <tr>
                    <th scope="row">Latest Stories</th>
                    <td>
                        <label>
                            <input type="checkbox"
                                   name="<?php echo esc_attr(YBB_HOME_OPTION); ?>[latestStoriesEnabled]"
                                   value="1" <?php checked(!empty($settings['latestStoriesEnabled'])); ?> />
                            在首页显�?Latest Stories 轮播
                        </label>
                    </td>
                </tr>
                <tr>
                    <th scope="row">Hot Products</th>
                    <td>
                        <label>
                            <input type="checkbox"
                                   name="<?php echo esc_attr(YBB_HOME_OPTION); ?>[hotProductsEnabled]"
                                   value="1" <?php checked(!empty($settings['hotProductsEnabled'])); ?> />
                            �?Wholesale collections 下方显示热销产品轮播（自动播放）
                        </label>
                        <p class="description" style="margin-top:8px;">
                            轮播间隔（毫秒）�?                            <input type="number" min="2000" max="15000" step="500"
                                   name="<?php echo esc_attr(YBB_HOME_OPTION); ?>[hotProductsAutoplayMs]"
                                   value="<?php echo esc_attr((string) ($settings['hotProductsAutoplayMs'] ?? 4000)); ?>"
                                   style="width:100px;" />
                        </p>
                    </td>
                </tr>
            </table>

            <h2 class="title">Latest Stories 卡片</h2>
            <p class="description">可添加、删除、改标题/摘要/日期/配图/链接。配图支持媒体库或站内路径（�?<code>/products/xxx/master.webp</code>）�?/p>

            <table class="widefat striped" id="ybb-stories-table" style="margin-top:12px;">
                <thead>
                    <tr>
                        <th style="width:48px;">显示</th>
                        <th style="width:18%;">标题</th>
                        <th style="width:22%;">摘要</th>
                        <th style="width:110px;">日期</th>
                        <th style="width:24%;">配图</th>
                        <th style="width:18%;">Slug / 链接</th>
                        <th style="width:72px;">操作</th>
                    </tr>
                </thead>
                <tbody>
                <?php foreach ($stories as $index => $story) : ?>
                    <tr class="ybb-story-row">
                        <td>
                            <input type="checkbox"
                                   name="<?php echo esc_attr(YBB_HOME_OPTION); ?>[latestStories][<?php echo (int) $index; ?>][enabled]"
                                   value="1" <?php checked(!empty($story['enabled'])); ?> />
                        </td>
                        <td>
                            <input type="hidden"
                                   name="<?php echo esc_attr(YBB_HOME_OPTION); ?>[latestStories][<?php echo (int) $index; ?>][id]"
                                   value="<?php echo esc_attr($story['id'] ?? ''); ?>" />
                            <input type="text" class="regular-text"
                                   name="<?php echo esc_attr(YBB_HOME_OPTION); ?>[latestStories][<?php echo (int) $index; ?>][title]"
                                   value="<?php echo esc_attr($story['title'] ?? ''); ?>" />
                        </td>
                        <td>
                            <textarea class="large-text" rows="2"
                                      name="<?php echo esc_attr(YBB_HOME_OPTION); ?>[latestStories][<?php echo (int) $index; ?>][excerpt]"><?php echo esc_textarea($story['excerpt'] ?? ''); ?></textarea>
                        </td>
                        <td>
                            <input type="date"
                                   name="<?php echo esc_attr(YBB_HOME_OPTION); ?>[latestStories][<?php echo (int) $index; ?>][publishedAt]"
                                   value="<?php echo esc_attr($story['publishedAt'] ?? ''); ?>" />
                        </td>
                        <td>
                            <div class="ybb-image-field">
                                <input type="text" class="large-text ybb-image-url"
                                       name="<?php echo esc_attr(YBB_HOME_OPTION); ?>[latestStories][<?php echo (int) $index; ?>][imageUrl]"
                                       value="<?php echo esc_attr($story['imageUrl'] ?? ''); ?>" />
                                <button type="button" class="button ybb-pick-image">选图</button>
                                <?php if (!empty($story['imageUrl'])) : ?>
                                    <div style="margin-top:8px;">
                                        <img src="<?php echo esc_url($story['imageUrl']); ?>" alt="" style="max-width:120px;height:auto;border:1px solid #ccd0d4;border-radius:4px;" />
                                    </div>
                                <?php endif; ?>
                            </div>
                        </td>
                        <td>
                            <input type="text" class="regular-text" placeholder="slug"
                                   name="<?php echo esc_attr(YBB_HOME_OPTION); ?>[latestStories][<?php echo (int) $index; ?>][handle]"
                                   value="<?php echo esc_attr($story['handle'] ?? ''); ?>" />
                            <input type="text" class="large-text" placeholder="/blogs/news/slug"
                                   name="<?php echo esc_attr(YBB_HOME_OPTION); ?>[latestStories][<?php echo (int) $index; ?>][articleUrl]"
                                   value="<?php echo esc_attr($story['articleUrl'] ?? ''); ?>" />
                        </td>
                        <td>
                            <button type="button" class="button ybb-remove-story">删除</button>
                        </td>
                    </tr>
                <?php endforeach; ?>
                </tbody>
            </table>

            <p style="margin-top:12px;">
                <button type="button" class="button" id="ybb-add-story">+ 添加故事卡片</button>
            </p>

            <h2 class="title">Hot Products 热销卡片</h2>
            <p class="description">填写产品 slug（与静态站 <code>/products/{slug}</code> 一致）。可覆盖标题与配图；保存后前台自动更新�?/p>

            <table class="widefat striped" id="ybb-hot-products-table" style="margin-top:12px;">
                <thead>
                    <tr>
                        <th style="width:48px;">显示</th>
                        <th style="width:22%;">产品 Handle</th>
                        <th style="width:28%;">标题覆盖</th>
                        <th style="width:32%;">配图覆盖</th>
                        <th style="width:72px;">操作</th>
                    </tr>
                </thead>
                <tbody>
                <?php foreach ($hotProducts as $index => $product) : ?>
                    <tr class="ybb-hot-row">
                        <td>
                            <input type="checkbox"
                                   name="<?php echo esc_attr(YBB_HOME_OPTION); ?>[hotProducts][<?php echo (int) $index; ?>][enabled]"
                                   value="1" <?php checked(!empty($product['enabled'])); ?> />
                        </td>
                        <td>
                            <input type="hidden"
                                   name="<?php echo esc_attr(YBB_HOME_OPTION); ?>[hotProducts][<?php echo (int) $index; ?>][id]"
                                   value="<?php echo esc_attr($product['id'] ?? ''); ?>" />
                            <input type="text" class="regular-text"
                                   name="<?php echo esc_attr(YBB_HOME_OPTION); ?>[hotProducts][<?php echo (int) $index; ?>][handle]"
                                   value="<?php echo esc_attr($product['handle'] ?? ''); ?>"
                                   placeholder="tz-qz-025" />
                        </td>
                        <td>
                            <input type="text" class="large-text"
                                   name="<?php echo esc_attr(YBB_HOME_OPTION); ?>[hotProducts][<?php echo (int) $index; ?>][titleOverride]"
                                   value="<?php echo esc_attr($product['titleOverride'] ?? ''); ?>"
                                   placeholder="留空则用 Woo 标题" />
                        </td>
                        <td>
                            <div class="ybb-image-field">
                                <input type="text" class="large-text ybb-image-url"
                                       name="<?php echo esc_attr(YBB_HOME_OPTION); ?>[hotProducts][<?php echo (int) $index; ?>][imageUrl]"
                                       value="<?php echo esc_attr($product['imageUrl'] ?? ''); ?>" />
                                <button type="button" class="button ybb-pick-image">选图</button>
                                <?php if (!empty($product['imageUrl'])) : ?>
                                    <div style="margin-top:8px;">
                                        <img src="<?php echo esc_url($product['imageUrl']); ?>" alt="" style="max-width:120px;height:auto;border:1px solid #ccd0d4;border-radius:4px;" />
                                    </div>
                                <?php endif; ?>
                            </div>
                        </td>
                        <td>
                            <button type="button" class="button ybb-remove-hot-product">删除</button>
                        </td>
                    </tr>
                <?php endforeach; ?>
                </tbody>
            </table>

            <p style="margin-top:12px;">
                <button type="button" class="button" id="ybb-add-hot-product">+ 添加热销产品</button>
            </p>

            <?php submit_button('保存首页设置'); ?>
        </form>

        <hr />
        <p><strong>REST</strong></p>
        <ul style="list-style:disc;margin-left:20px;">
            <li><code><?php echo esc_html(rest_url('ybb/v1/home-settings')); ?></code></li>
            <li><code><?php echo esc_html(rest_url('ybb/v1/latest-stories')); ?></code></li>
            <li><code><?php echo esc_html(rest_url('ybb/v1/hot-products')); ?></code></li>
        </ul>
    </div>
    <style>
        .ybb-home-settings .ybb-image-field { display: flex; flex-direction: column; gap: 6px; max-width: 280px; }
        .ybb-home-settings #ybb-stories-table { table-layout: fixed; width: 100%; max-width: 1200px; }
        .ybb-home-settings #ybb-stories-table th,
        .ybb-home-settings #ybb-stories-table td { vertical-align: top; padding: 10px 8px; word-wrap: break-word; }
        .ybb-home-settings #ybb-stories-table input.regular-text,
        .ybb-home-settings #ybb-stories-table input.large-text,
        .ybb-home-settings #ybb-stories-table textarea { width: 100%; box-sizing: border-box; }
        .ybb-home-settings #ybb-stories-table textarea { min-height: 64px; resize: vertical; }
        .ybb-home-settings #ybb-stories-table .ybb-pick-image { align-self: flex-start; }
        .ybb-home-settings #ybb-add-story { margin-top: 4px; }
        .ybb-home-settings #ybb-hot-products-table { table-layout: fixed; width: 100%; max-width: 1200px; }
        .ybb-home-settings #ybb-hot-products-table th,
        .ybb-home-settings #ybb-hot-products-table td { vertical-align: top; padding: 10px 8px; word-wrap: break-word; }
        .ybb-home-settings #ybb-hot-products-table input.regular-text,
        .ybb-home-settings #ybb-hot-products-table input.large-text { width: 100%; box-sizing: border-box; }
        .ybb-home-settings #ybb-add-hot-product { margin-top: 4px; }
        @media (max-width: 1200px) {
            .ybb-home-settings #ybb-stories-table { display: block; overflow-x: auto; }
            .ybb-home-settings #ybb-hot-products-table { display: block; overflow-x: auto; }
        }
    </style>
    <?php
}

add_action('rest_api_init', function () {
    register_rest_route('ybb/v1', '/home-settings', [
        'methods' => 'GET',
        'permission_callback' => '__return_true',
        'callback' => function () {
            return rest_ensure_response(ybb_home_settings_get());
        },
    ]);

    register_rest_route('ybb/v1', '/latest-stories', [
        'methods' => 'GET',
        'permission_callback' => '__return_true',
        'callback' => function () {
            if (function_exists('ybb_sm_latest_stories_public')) {
                return rest_ensure_response(ybb_sm_latest_stories_public());
            }

            return rest_ensure_response([
                'enabled' => !empty(ybb_home_settings_get()['latestStoriesEnabled']),
                'articles' => ybb_home_latest_stories_public(),
                'syncedAt' => gmdate('c'),
            ]);
        },
    ]);

    register_rest_route('ybb/v1', '/hot-products', [
        'methods' => 'GET',
        'permission_callback' => '__return_true',
        'callback' => function () {
            if (function_exists('ybb_sm_hot_products_public')) {
                return rest_ensure_response(ybb_sm_hot_products_public());
            }

            $settings = ybb_home_resolved_settings();

            return rest_ensure_response([
                'enabled' => !empty($settings['hotProductsEnabled']),
                'autoplayMs' => (int) ($settings['hotProductsAutoplayMs'] ?? 4000),
                'products' => ybb_home_hot_products_public(),
                'syncedAt' => gmdate('c'),
            ]);
        },
    ]);
});
