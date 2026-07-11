<?php
/**
 * Probe wp-admin bootstrap without auth. ?key=ybb-migrate-20260624
 */
header('Content-Type: text/plain; charset=utf-8');
if (($_GET['key'] ?? '') !== 'ybb-migrate-20260624') {
    http_response_code(403);
    exit("forbidden\n");
}
$errors = [];
set_error_handler(static function ($no, $str, $file, $line) use (&$errors) {
    $errors[] = "[$no] $str in $file:$line";
    return false;
});
register_shutdown_function(static function () use (&$errors) {
    $e = error_get_last();
    if ($e && in_array($e['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR], true)) {
        echo "\nSHUTDOWN FATAL:\n" . print_r($e, true);
    }
    if ($errors) {
        echo "\nERRORS:\n" . implode("\n", $errors) . "\n";
    }
});

define('WP_ADMIN', true);
define('WP_USE_THEMES', false);
require __DIR__ . '/wp-load.php';
echo "wp-load OK\n";

require_once ABSPATH . 'wp-admin/includes/admin.php';
echo "admin.php OK\n";

require_once ABSPATH . 'wp-admin/includes/dashboard.php';
echo "dashboard.php OK\n";

do_action('admin_init');
echo "admin_init OK\n";

if (function_exists('get_current_screen')) {
    set_current_screen('dashboard');
    echo "screen=dashboard\n";
}

do_action('load-index.php');
echo "load-index.php OK\n";

echo "DONE\n";
