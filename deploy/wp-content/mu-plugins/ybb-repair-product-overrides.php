<?php
/**
 * One-shot repair: seed product overrides from product-overrides-seed.json.
 * GET https://carp-ybb.com/?ybb_repair_product_overrides=1&key=DEPLOY_SECRET
 */
add_action('init', static function () {
    if (empty($_GET['ybb_repair_product_overrides'])) {
        return;
    }

    $deploy = function_exists('ybb_sm_deploy_get') ? ybb_sm_deploy_get() : [];
    $secret = (string) ($deploy['secret'] ?? '');
    $key = (string) ($_GET['key'] ?? '');
    if ($secret === '' || !hash_equals($secret, $key)) {
        status_header(403);
        header('Content-Type: application/json; charset=utf-8');
        echo wp_json_encode(['error' => 'forbidden']);
        exit;
    }

    if (!function_exists('ybb_sm_products_seed_overrides_from_file')) {
        status_header(500);
        header('Content-Type: application/json; charset=utf-8');
        echo wp_json_encode(['error' => 'migrate not loaded']);
        exit;
    }

    delete_option('ybb_sm_products_migrated');
    delete_option('ybb_sm_product_overrides');
    ybb_sm_maybe_migrate_products();

    $overrides = function_exists('ybb_sm_product_overrides_all') ? ybb_sm_product_overrides_all() : [];
    $path = defined('YBB_SM_DIR')
        ? YBB_SM_DIR . '/includes/product-overrides-seed.json'
        : '';

    header('Content-Type: application/json; charset=utf-8');
    echo wp_json_encode([
        'seedPath' => $path,
        'seedReadable' => $path !== '' && is_readable($path),
        'seedBytes' => ($path !== '' && is_readable($path)) ? filesize($path) : 0,
        'seedParsed' => count(ybb_sm_products_seed_overrides_from_file()),
        'storedCount' => count($overrides),
        'sample' => $overrides['tz-zbsb-006']['titleZh'] ?? null,
    ], JSON_UNESCAPED_UNICODE);
    exit;
});
