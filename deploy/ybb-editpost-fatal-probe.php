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
    'site' => home_url(),
    'muCaptureExists' => file_exists(WP_CONTENT_DIR . '/mu-plugins/ybb-editpost-fatal-capture.php'),
    'request' => get_option('ybb_last_editpost_request', null),
    'error' => get_option('ybb_last_editpost_error', null),
    'exception' => get_option('ybb_last_editpost_exception', null),
    'shutdown' => get_option('ybb_last_editpost_shutdown', null),
    'fatal' => get_option('ybb_last_editpost_fatal', null),
];

echo json_encode($out, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);

