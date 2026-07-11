<?php
/**
 * One-shot: surface last PHP error after loading WordPress admin bootstrap.
 * Upload to public_html, open once, delete immediately.
 *
 * ?key=ybb-migrate-20260624
 */
require __DIR__ . '/wp-load.php';
header('Content-Type: text/plain; charset=utf-8');
header('Cache-Control: no-store');

$expectedKey = 'ybb-migrate-20260624';
if (($_GET['key'] ?? '') !== $expectedKey) {
    http_response_code(403);
    exit("forbidden\n");
}

$report = [
    'wpVersion' => get_bloginfo('version'),
    'php' => PHP_VERSION,
    'muPlugins' => [],
    'errors' => [],
];

foreach (get_mu_plugins() as $file => $data) {
    $report['muPlugins'][] = [
        'file' => $file,
        'name' => $data['Name'] ?? '',
        'version' => $data['Version'] ?? '',
    ];
}

set_error_handler(static function ($severity, $message, $file, $line) use (&$report) {
    $report['errors'][] = compact('severity', 'message', 'file', 'line');
    return false;
});

register_shutdown_function(static function () use (&$report) {
    $err = error_get_last();
    if ($err && in_array($err['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR], true)) {
        $report['fatal'] = $err;
    }
    echo json_encode($report, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
});

// Trigger admin bootstrap paths that often fatal.
if (!function_exists('wp_dashboard')) {
    require_once ABSPATH . 'wp-admin/includes/admin.php';
}
if (function_exists('ybb_sm_products_module')) {
    $report['ybb_sm_ok'] = true;
    try {
        ybb_sm_product_overrides_public();
        $report['ybb_sm_overrides_ok'] = true;
    } catch (Throwable $e) {
        $report['errors'][] = [
            'message' => $e->getMessage(),
            'file' => $e->getFile(),
            'line' => $e->getLine(),
        ];
    }
}

do_action('admin_init');
