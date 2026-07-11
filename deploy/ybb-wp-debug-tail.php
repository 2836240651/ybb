<?php
/**
 * One-time: show last PHP fatal from debug.log (delete after use).
 * ?key=ybb-migrate-20260624
 */
require __DIR__ . '/wp-load.php';
header('Content-Type: text/plain; charset=utf-8');
header('Cache-Control: no-store');

if (($_GET['key'] ?? '') !== 'ybb-migrate-20260624') {
    http_response_code(403);
    exit("forbidden\n");
}

$candidates = [
    WP_CONTENT_DIR . '/debug.log',
    ABSPATH . 'wp-content/debug.log',
    ABSPATH . 'error_log',
    ABSPATH . 'php_errorlog',
];
$iniErrorLog = (string) ini_get('error_log');
if ($iniErrorLog !== '') {
    $candidates[] = $iniErrorLog;
}
$candidates = array_values(array_unique(array_filter($candidates, static fn($p) => is_string($p) && $p !== '')));

echo "WP_DEBUG=" . (defined('WP_DEBUG') && WP_DEBUG ? '1' : '0') . "\n";
echo "ini_error_log=" . ($iniErrorLog !== '' ? $iniErrorLog : '(empty)') . "\n";
echo "active_plugins=" . count((array) get_option('active_plugins', [])) . "\n";
echo "mu-plugins:\n";
foreach (glob(WPMU_PLUGIN_DIR . '/*.php') ?: [] as $f) {
    echo '  - ' . basename($f) . "\n";
}
echo "\n--- log tail ---\n";

$found = false;
foreach ($candidates as $path) {
    if (!is_readable($path)) {
        continue;
    }
    $found = true;
    echo "FILE: $path\n";
    $lines = @file($path, FILE_IGNORE_NEW_LINES);
    if (!$lines) {
        echo "(empty)\n";
        continue;
    }
    echo implode("\n", array_slice($lines, -40)) . "\n";
}
if (!$found) {
    echo "no readable debug.log — enable WP_DEBUG_LOG in wp-config\n";
}
