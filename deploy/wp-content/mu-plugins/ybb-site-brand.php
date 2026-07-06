<?php
/**
 * Plugin Name: YBB Site Brand
 * Description: Site title + multilingual tagline for static frontend sync (header/footer).
 * Version: 1.0.0
 */

if (!defined('ABSPATH')) {
    exit;
}

const YBB_BRAND_OPTION = 'ybb_site_brand';

function ybb_site_brand_defaults(): array
{
    return [
        'name' => 'YBB',
        'tagline' => [
            'en' => 'Trusted Tackle Partner',
            'zh' => '值得信赖的渔具合作伙�?,
            'ja' => '信頼できるタックルパートナー',
        ],
        'logoAlt' => 'YBB',
        'logoPath' => '/images/brand/ybb-logo.png',
    ];
}

function ybb_site_brand_get(): array
{
    $stored = get_option(YBB_BRAND_OPTION, []);
    if (!is_array($stored)) {
        $stored = [];
    }

    $defaults = ybb_site_brand_defaults();
    $name = trim((string) ($stored['name'] ?? get_option('blogname', $defaults['name'])));
    if ($name === '') {
        $name = $defaults['name'];
    }

    $tagline = $defaults['tagline'];
    if (!empty($stored['tagline']) && is_array($stored['tagline'])) {
        foreach (['en', 'zh', 'ja'] as $locale) {
            $value = trim((string) ($stored['tagline'][$locale] ?? ''));
            if ($value !== '') {
                $tagline[$locale] = $value;
            }
        }
    } else {
        $wpTagline = trim((string) get_option('blogdescription', ''));
        if ($wpTagline !== '') {
            $tagline['en'] = $wpTagline;
        }
    }

    return [
        'name' => $name,
        'tagline' => $tagline,
        'logoAlt' => trim((string) ($stored['logoAlt'] ?? $name)) ?: $name,
        'logoPath' => trim((string) ($stored['logoPath'] ?? $defaults['logoPath'])) ?: $defaults['logoPath'],
        'source' => 'wordpress',
        'syncedAt' => gmdate('c'),
    ];
}

function ybb_site_brand_sanitize($input): array
{
    $defaults = ybb_site_brand_defaults();
    $input = is_array($input) ? $input : [];

    $name = sanitize_text_field($input['name'] ?? $defaults['name']);
    $tagline = $defaults['tagline'];
    if (!empty($input['tagline']) && is_array($input['tagline'])) {
        foreach (['en', 'zh', 'ja'] as $locale) {
            $tagline[$locale] = sanitize_text_field($input['tagline'][$locale] ?? $tagline[$locale]);
        }
    }

    return [
        'name' => $name !== '' ? $name : $defaults['name'],
        'tagline' => $tagline,
        'logoAlt' => sanitize_text_field($input['logoAlt'] ?? $name),
        'logoPath' => esc_url_raw($input['logoPath'] ?? $defaults['logoPath']),
    ];
}

add_action('admin_init', function () {
    register_setting('ybb_site_brand_group', YBB_BRAND_OPTION, [
        'type' => 'array',
        'sanitize_callback' => 'ybb_site_brand_sanitize',
        'default' => ybb_site_brand_defaults(),
    ]);
});

add_action('admin_menu', function () {
    add_options_page(
        'YBB Site Brand',
        'YBB Site Brand',
        'manage_options',
        'ybb-site-brand',
        'ybb_site_brand_render_settings_page'
    );
});

function ybb_site_brand_render_settings_page(): void
{
    if (!current_user_can('manage_options')) {
        return;
    }

    $brand = ybb_site_brand_get();
    ?>
    <div class="wrap">
        <h1>YBB Site Brand</h1>
        <p>主标题与副标题会同步到静态前端页�?/ 页脚。修改后请运�?<code>sync-from-wp.mjs</code> 并重新部署�?/p>
        <form method="post" action="options.php">
            <?php settings_fields('ybb_site_brand_group'); ?>
            <table class="form-table" role="presentation">
                <tr>
                    <th scope="row"><label for="ybb_brand_name">主标�?/label></th>
                    <td>
                        <input name="<?php echo esc_attr(YBB_BRAND_OPTION); ?>[name]" id="ybb_brand_name"
                               type="text" class="regular-text"
                               value="<?php echo esc_attr($brand['name']); ?>" />
                    </td>
                </tr>
                <tr>
                    <th scope="row"><label for="ybb_tagline_en">副标�?(English)</label></th>
                    <td>
                        <input name="<?php echo esc_attr(YBB_BRAND_OPTION); ?>[tagline][en]" id="ybb_tagline_en"
                               type="text" class="large-text"
                               value="<?php echo esc_attr($brand['tagline']['en']); ?>" />
                    </td>
                </tr>
                <tr>
                    <th scope="row"><label for="ybb_tagline_zh">副标�?(中文)</label></th>
                    <td>
                        <input name="<?php echo esc_attr(YBB_BRAND_OPTION); ?>[tagline][zh]" id="ybb_tagline_zh"
                               type="text" class="large-text"
                               value="<?php echo esc_attr($brand['tagline']['zh']); ?>" />
                    </td>
                </tr>
                <tr>
                    <th scope="row"><label for="ybb_tagline_ja">副标�?(日本�?</label></th>
                    <td>
                        <input name="<?php echo esc_attr(YBB_BRAND_OPTION); ?>[tagline][ja]" id="ybb_tagline_ja"
                               type="text" class="large-text"
                               value="<?php echo esc_attr($brand['tagline']['ja']); ?>" />
                    </td>
                </tr>
            </table>
            <?php submit_button('保存品牌设置'); ?>
        </form>
        <p><strong>REST:</strong> <code><?php echo esc_html(rest_url('ybb/v1/site-brand')); ?></code></p>
    </div>
    <?php
}

add_action('update_option_' . YBB_BRAND_OPTION, function ($old, $new) {
    if (!is_array($new)) {
        return;
    }
    $name = trim((string) ($new['name'] ?? ''));
    if ($name !== '') {
        update_option('blogname', $name);
    }
    $en = trim((string) ($new['tagline']['en'] ?? ''));
    if ($en !== '') {
        update_option('blogdescription', $en);
    }
}, 10, 2);

add_action('rest_api_init', function () {
    register_rest_route('ybb/v1', '/site-brand', [
        'methods' => 'GET',
        'permission_callback' => '__return_true',
        'callback' => function () {
            return rest_ensure_response(ybb_site_brand_get());
        },
    ]);
});
