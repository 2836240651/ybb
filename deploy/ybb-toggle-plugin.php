<?php
/**
 * One-off plugin toggler for wp-admin save debugging.
 * Usage:
 *   /ybb-toggle-plugin.php?key=...&op=deactivate&plugin=variation-swatches-woo/variation-swatches-woo.php
 *   /ybb-toggle-plugin.php?key=...&op=activate&plugin=variation-swatches-woo/variation-swatches-woo.php
 */
require __DIR__ . '/wp-load.php';
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

if (($_GET['key'] ?? '') !== 'ybb-migrate-20260624') {
    http_response_code(403);
    echo json_encode(['error' => 'forbidden']);
    exit;
}

if (!function_exists('get_plugins')) {
    require_once ABSPATH . 'wp-admin/includes/plugin.php';
}

$plugin = (string) ($_GET['plugin'] ?? '');
$op = (string) ($_GET['op'] ?? 'status');
$allow = [
    'variation-swatches-woo/variation-swatches-woo.php',
    'seo-by-rank-math/rank-math.php',
    'cartflows/cartflows.php',
];

if ($plugin !== '' && !in_array($plugin, $allow, true)) {
    http_response_code(400);
    echo json_encode(['error' => 'plugin_not_allowed', 'plugin' => $plugin, 'allow' => $allow], JSON_UNESCAPED_SLASHES);
    exit;
}

$all = get_plugins();
$active = (array) get_option('active_plugins', []);
$isActive = $plugin !== '' ? in_array($plugin, $active, true) : null;

$result = [
    'op' => $op,
    'plugin' => $plugin,
    'isActiveBefore' => $isActive,
    'knownPlugin' => $plugin !== '' ? isset($all[$plugin]) : null,
];

if ($plugin !== '' && isset($all[$plugin])) {
    if ($op === 'deactivate') {
        deactivate_plugins($plugin, true, false);
    } elseif ($op === 'activate') {
        $err = activate_plugin($plugin, '', false, true);
        if (is_wp_error($err)) {
            $result['activateError'] = $err->get_error_message();
        }
    }
}

$activeAfter = (array) get_option('active_plugins', []);
$result['isActiveAfter'] = $plugin !== '' ? in_array($plugin, $activeAfter, true) : null;
$result['activeCount'] = count($activeAfter);
$result['sampleActive'] = array_slice($activeAfter, 0, 10);

echo json_encode($result, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
