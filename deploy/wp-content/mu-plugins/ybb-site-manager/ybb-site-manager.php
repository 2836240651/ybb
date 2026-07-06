<?php
/**
 * Plugin Name: YBB Site Manager
 * Description: Unified site configuration �?navigation, announcements, hero, home modules, deploy queue.
 * Version: 1.8.8
 */

if (!defined('ABSPATH')) {
    exit;
}

define('YBB_SM_VERSION', '1.8.8');
define('YBB_SM_DIR', __DIR__);
define('YBB_SM_OPTION', 'ybb_site_manager_settings');

/** Bust opcode cache after mu-plugin deploy (SiteGround keeps stale PHP otherwise). */
$__ybb_sm_code_ver = (string) get_option('ybb_sm_code_version', '');
if ($__ybb_sm_code_ver !== YBB_SM_VERSION && function_exists('opcache_invalidate')) {
    $__ybb_sm_globs = [
        YBB_SM_DIR . '/includes/*.php',
        YBB_SM_DIR . '/includes/modules/*.php',
        YBB_SM_DIR . '/includes/admin/*.php',
    ];
    foreach ($__ybb_sm_globs as $__ybb_sm_pattern) {
        foreach (glob($__ybb_sm_pattern) ?: [] as $__ybb_sm_php) {
            opcache_invalidate($__ybb_sm_php, true);
        }
    }
    opcache_invalidate(__FILE__, true);
    update_option('ybb_sm_code_version', YBB_SM_VERSION, false);
}
unset($__ybb_sm_code_ver, $__ybb_sm_globs, $__ybb_sm_pattern, $__ybb_sm_php);

require_once YBB_SM_DIR . '/includes/defaults.php';
require_once YBB_SM_DIR . '/includes/class-settings.php';
require_once YBB_SM_DIR . '/includes/class-sanitize.php'; // before admin_init
require_once YBB_SM_DIR . '/includes/modules/navigation.php';
require_once YBB_SM_DIR . '/includes/modules/announcements.php';
require_once YBB_SM_DIR . '/includes/modules/hero.php';
require_once YBB_SM_DIR . '/includes/modules/blog.php';
require_once YBB_SM_DIR . '/includes/modules/pdp.php';
require_once YBB_SM_DIR . '/includes/modules/products.php';
require_once YBB_SM_DIR . '/includes/modules/product-description-editor.php';
require_once YBB_SM_DIR . '/includes/modules/product-index.php';
require_once YBB_SM_DIR . '/includes/modules/home.php';
require_once YBB_SM_DIR . '/includes/modules/brand.php';
require_once YBB_SM_DIR . '/includes/modules/contact.php';
require_once YBB_SM_DIR . '/includes/modules/video.php';
require_once YBB_SM_DIR . '/includes/modules/featured.php';
require_once YBB_SM_DIR . '/includes/modules/deploy-queue.php';
require_once YBB_SM_DIR . '/includes/modules/audit-log.php';
require_once YBB_SM_DIR . '/includes/class-rest.php';
require_once YBB_SM_DIR . '/includes/migrate.php';
require_once YBB_SM_DIR . '/includes/admin/tab-products.php';
require_once YBB_SM_DIR . '/includes/admin/page.php';

add_action('plugins_loaded', 'ybb_sm_maybe_migrate', 5);

add_action('admin_menu', function () {
    add_menu_page(
        'YBB 站点管理',
        'YBB 站点管理',
        'manage_options',
        'ybb-site-manager',
        'ybb_sm_render_admin_page',
        'dashicons-admin-site',
        58
    );
});

add_action('admin_init', function () {
    register_setting('ybb_sm_group', YBB_SM_OPTION, [
        'type' => 'array',
        'sanitize_callback' => 'ybb_sm_sanitize_settings',
        'default' => ybb_sm_defaults(),
    ]);
});

add_action('admin_notices', function () {
    if (!current_user_can('manage_options')) {
        return;
    }
    $screen = function_exists('get_current_screen') ? get_current_screen() : null;
    if (!$screen || $screen->id !== 'toplevel_page_ybb-site-manager') {
        return;
    }
    $warnings = get_transient('ybb_sm_nav_empty_' . get_current_user_id());
    if (!is_array($warnings) || $warnings === []) {
        return;
    }
    delete_transient('ybb_sm_nav_empty_' . get_current_user_id());
    echo '<div class="notice notice-warning is-dismissible"><p><strong>导航已保存，但以下类目无 publish 商品�?/strong></p><ul style="margin-left:1.2em;list-style:disc;">';
    foreach ($warnings as $warning) {
        if (!is_array($warning)) {
            continue;
        }
        $handle = esc_html((string) ($warning['handle'] ?? ''));
        $label = esc_html((string) ($warning['label'] ?? ''));
        echo '<li><code>' . $handle . '</code> �?' . $label . '</li>';
    }
    echo '</ul><p>访客点击后将看到空列表页。请隐藏对应导航项，或上架商品后重建静态站�?/p></div>';
});

add_action('admin_enqueue_scripts', function ($hook) {
    if ($hook !== 'toplevel_page_ybb-site-manager') {
        return;
    }
    wp_enqueue_media();
    wp_register_script('ybb-sm-admin', false, ['jquery'], YBB_SM_VERSION, true);
    wp_enqueue_script('ybb-sm-admin');
    wp_add_inline_script('ybb-sm-admin', 'window.ybbSmOptionName = ' . wp_json_encode(YBB_SM_OPTION) . ';');
    wp_add_inline_script('ybb-sm-admin', <<<'JS'
jQuery(function ($) {
  $(document).on('click', '.ybb-sm-pick-image', function (e) {
    e.preventDefault();
    var $btn = $(this);
    var $input = $($btn.data('target'));
    var frame = wp.media({ title: 'Select image', multiple: false, library: { type: 'image' } });
    frame.on('select', function () {
      var att = frame.state().get('selection').first().toJSON();
      $input.val(att.url || '');
    });
    frame.open();
  });
  $(document).on('click', '.ybb-sm-add-row', function (e) {
    e.preventDefault();
    var $table = $($btn = $(this)).closest('.ybb-sm-repeater').find('tbody');
    var tpl = $($btn.data('template')).html();
    var idx = $table.find('tr').length;
    $table.append(tpl.replace(/__INDEX__/g, String(idx)));
  });
  $(document).on('click', '.ybb-sm-remove-row', function (e) {
    e.preventDefault();
    $(this).closest('tr').remove();
  });
});
JS
    );
});
