<?php
/**
 * Plugin Name: YBB Latest Stories Hydrate
 * Description: Disabled safe stub �?Latest Stories handled by React BlogCarousel fetch.
 * Version: 1.4.1
 */

if (!defined('ABSPATH')) {
    exit;
}

add_action('rest_api_init', function () {
    register_rest_route('ybb/v1', '/latest-stories-hydrate.js', [
        'methods' => 'GET',
        'permission_callback' => '__return_true',
        'callback' => 'ybb_latest_stories_hydrate_js',
    ]);
});

function ybb_latest_stories_hydrate_js(): void
{
    header('Content-Type: application/javascript; charset=utf-8');
    header('Cache-Control: public, max-age=60');
    echo '/* ybb latest-stories hydrate disabled �?use React BlogCarousel */';
    exit;
}
