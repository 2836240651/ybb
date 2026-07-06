<?php
/**
 * Plugin Name: YBB Hot Products Hydrate
 * Description: Disabled safe stub �?Hot Products handled by React client fetch.
 * Version: 1.3.0
 */

if (!defined('ABSPATH')) {
    exit;
}

add_action('rest_api_init', function () {
    register_rest_route('ybb/v1', '/hot-products-hydrate.js', [
        'methods' => 'GET',
        'permission_callback' => '__return_true',
        'callback' => 'ybb_hot_products_hydrate_js',
    ]);
});

function ybb_hot_products_hydrate_js(): void
{
    header('Content-Type: application/javascript; charset=utf-8');
    header('Cache-Control: public, max-age=60');
    echo '/* ybb hot-products hydrate disabled �?use React HotProductsCarousel */';
    exit;
}
