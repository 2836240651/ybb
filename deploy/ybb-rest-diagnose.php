<?php
// One-shot REST diagnose. Delete after use.
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
require_once __DIR__ . '/wp-load.php';

$out = [
    'version' => defined('YBB_SM_VERSION') ? YBB_SM_VERSION : null,
    'codeVersion' => get_option('ybb_sm_code_version', null),
    'classRest' => is_file(ABSPATH . 'wp-content/mu-plugins/ybb-site-manager/includes/class-rest.php')
        ? filesize(ABSPATH . 'wp-content/mu-plugins/ybb-site-manager/includes/class-rest.php')
        : null,
];

try {
    if (!function_exists('ybb_sm_navigation_public')) {
        $out['error'] = 'ybb_sm_navigation_public missing';
        echo wp_json_encode($out, JSON_UNESCAPED_UNICODE);
        exit;
    }
    $nav = ybb_sm_navigation_public();
    $out['navigationKeys'] = array_keys($nav);
    $out['navigationEnabled'] = $nav['enabled'] ?? null;

    if (function_exists('ybb_sm_product_live_payload')) {
        $live = ybb_sm_product_live_payload('tz-hk-001');
        $out['liveHandle'] = is_array($live) ? ($live['handle'] ?? null) : null;
        $out['liveImages'] = is_array($live) ? ($live['images'] ?? []) : null;
    }

    $request = new WP_REST_Request('GET', '/ybb/v1/site-manager/navigation');
    $response = rest_do_request($request);
    $out['restStatus'] = $response->get_status();
    $out['restData'] = $response->get_data();
    $out['restError'] = $response->is_error() ? $response->as_error()->get_error_message() : null;
    $out['ok'] = true;
} catch (Throwable $e) {
    $out['ok'] = false;
    $out['exception'] = $e->getMessage();
    $out['file'] = $e->getFile();
    $out['line'] = $e->getLine();
}

echo wp_json_encode($out, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
