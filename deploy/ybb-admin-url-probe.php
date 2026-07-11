<?php
require __DIR__ . '/wp-load.php';
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

$key = 'ybb-migrate-20260624';
if (($_GET['key'] ?? '') !== $key) {
    http_response_code(403);
    echo json_encode(['error' => 'forbidden']);
    exit;
}

$out = [
    'home_url' => home_url('/'),
    'site_url' => site_url('/'),
    'admin_url_root' => admin_url('/'),
    'admin_url_index' => admin_url('index.php'),
    'admin_url_load_styles' => admin_url('load-styles.php'),
    'admin_url_load_scripts' => admin_url('load-scripts.php'),
    'self' => $_SERVER['PHP_SELF'] ?? null,
    'request_uri' => $_SERVER['REQUEST_URI'] ?? null,
    'script_name' => $_SERVER['SCRIPT_NAME'] ?? null,
];

echo json_encode($out, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);

