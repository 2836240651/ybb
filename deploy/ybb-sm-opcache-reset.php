<?php
/**
 * Emergency opcode cache reset after mu-plugin deploy. Delete after use.
 */
$key = (string) ($_GET['key'] ?? '');
if ($key !== 'ybb-migrate-20260624') {
    http_response_code(403);
    exit('forbidden');
}
header('Content-Type: text/plain; charset=utf-8');
if (function_exists('opcache_reset')) {
    opcache_reset();
    echo "opcache_reset=ok\n";
} else {
    echo "opcache_reset=unavailable\n";
}
if (function_exists('opcache_invalidate')) {
    $dir = __DIR__ . '/wp-content/mu-plugins/ybb-site-manager';
    foreach (glob($dir . '/**/*.php') ?: [] as $php) {
        opcache_invalidate($php, true);
    }
    opcache_invalidate(__DIR__ . '/wp-content/mu-plugins/ybb-site-manager-loader.php', true);
    echo "opcache_invalidate=ok\n";
}
echo "code_version_option=" . (string) get_option('ybb_sm_code_version', '') . "\n";
