<?php

if (!defined('ABSPATH')) {
    exit;
}

function ybb_sm_maybe_migrate(): void
{
    if (get_option('ybb_sm_migrated', false)) {
        return;
    }

    $existing = get_option(YBB_SM_OPTION, null);
    if (is_array($existing) && !empty($existing['navigation']['primaryNav'])) {
        update_option('ybb_sm_migrated', true);

        return;
    }

    $defaults = ybb_sm_defaults();
    $merged = $defaults;

    if (function_exists('ybb_home_settings_get')) {
        $merged['home'] = ybb_home_settings_get();
    } elseif (defined('YBB_HOME_OPTION')) {
        $home = get_option(YBB_HOME_OPTION, []);
        if (is_array($home) && !empty($home)) {
            $merged['home'] = $home;
        }
    }

    if (function_exists('ybb_site_brand_get')) {
        $brand = ybb_site_brand_get();
        unset($brand['source'], $brand['syncedAt']);
        $merged['brand'] = $brand;
    } elseif (defined('YBB_BRAND_OPTION')) {
        $brand = get_option(YBB_BRAND_OPTION, []);
        if (is_array($brand) && !empty($brand)) {
            $merged['brand'] = array_replace($defaults['brand'], $brand);
        }
    }

    $deploy = $merged['deploy'] ?? [];
    if (empty($deploy['secret'])) {
        $deploy['secret'] = wp_generate_password(32, false, false);
    }
    $merged['deploy'] = $deploy;

    update_option(YBB_SM_OPTION, $merged);
    update_option('ybb_sm_migrated', true);
}

function ybb_sm_maybe_migrate_blog(): void
{
    if (get_option('ybb_sm_blog_migrated', false)) {
        return;
    }

    $all = ybb_sm_get_all();
    $articles = $all['blog']['articles'] ?? [];
    if (is_array($articles) && count($articles) > 0) {
        update_option('ybb_sm_blog_migrated', true);

        return;
    }

    $all['blog'] = ybb_sm_blog_defaults();
    update_option(YBB_SM_OPTION, $all);
    update_option('ybb_sm_blog_migrated', true);
}

add_action('plugins_loaded', 'ybb_sm_maybe_migrate_blog', 6);

function ybb_sm_products_seed_overrides_from_file(): array
{
    $path = YBB_SM_DIR . '/includes/product-overrides-seed.json';
    if (!is_readable($path)) {
        return [];
    }

    $seed = json_decode((string) file_get_contents($path), true);
    if (!is_array($seed)) {
        return [];
    }

    $overrides = [];
    foreach ($seed as $handle => $row) {
        if (!is_array($row)) {
            continue;
        }
        $handle = sanitize_title((string) $handle);
        if ($handle === '') {
            continue;
        }
        $titleZh = trim((string) ($row['titleZh'] ?? ''));
        $titleJa = trim((string) ($row['titleJa'] ?? ''));
        if ($titleZh === '' && $titleJa === '') {
            continue;
        }
        $overrides[$handle] = [
            'titleZh' => $titleZh,
            'titleJa' => $titleJa,
            'frontHidden' => false,
            'updatedAt' => gmdate('c'),
        ];
    }

    return $overrides;
}

function ybb_sm_maybe_migrate_products(): void
{
    if (count(ybb_sm_product_overrides_all()) > 0) {
        if (!get_option('ybb_sm_products_migrated', false)) {
            update_option('ybb_sm_products_migrated', true);
        }

        return;
    }

    $all = ybb_sm_get_all();
    $products = is_array($all['products'] ?? null) ? $all['products'] : [];

    $overrides = ybb_sm_products_seed_overrides_from_file();
    if ($overrides === []) {
        delete_option('ybb_sm_products_migrated');

        return;
    }

    delete_option(YBB_SM_PRODUCT_OVERRIDES_OPTION);
    ybb_sm_product_overrides_save($overrides);

    if (isset($products['productIndex']['staticHandles'])) {
        unset($products['productIndex']['staticHandles']);
    }
    unset($products['overrides']);

    $products = array_replace(ybb_sm_products_defaults(), $products, [
        'enabled' => true,
    ]);
    $all['products'] = $products;
    update_option(YBB_SM_OPTION, $all);
    update_option('ybb_sm_products_migrated', true);
    if (function_exists('ybb_sm_product_catalog_flush_cache')) {
        ybb_sm_product_catalog_flush_cache();
    }
}

add_action('plugins_loaded', 'ybb_sm_maybe_migrate_products', 7);

function ybb_sm_reset_module(string $module): void
{
    $defaults = ybb_sm_defaults();
    if (!isset($defaults[$module])) {
        return;
    }
    $all = ybb_sm_get_all();
    $all[$module] = $defaults[$module];
    update_option(YBB_SM_OPTION, $all);
}

add_action('admin_post_ybb_sm_reset_module', function () {
    if (!current_user_can('manage_options')) {
        wp_die('Forbidden');
    }
    check_admin_referer('ybb_sm_reset_module');
    $module = sanitize_key($_POST['module'] ?? '');
    if ($module !== '') {
        ybb_sm_reset_module($module);
        if (function_exists('ybb_sm_audit_log_reset')) {
            ybb_sm_audit_log_reset($module);
        }
    }
    wp_safe_redirect(add_query_arg(['page' => 'ybb-site-manager', 'tab' => $module, 'reset' => '1'], admin_url('admin.php')));
    exit;
});

add_action('admin_post_ybb_sm_trigger_deploy', function () {
    if (!current_user_can('manage_options')) {
        wp_die('Forbidden');
    }
    check_admin_referer('ybb_sm_trigger_deploy');
    ybb_sm_deploy_queue('manual');
    wp_safe_redirect(add_query_arg(['page' => 'ybb-site-manager', 'tab' => 'deploy', 'queued' => '1'], admin_url('admin.php')));
    exit;
});
