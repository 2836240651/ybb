<?php
/**
 * Minimal WP bootstrap probe. ?key=ybb-migrate-20260624
 */
header('Content-Type: text/plain; charset=utf-8');
if (($_GET['key'] ?? '') !== 'ybb-migrate-20260624') {
    http_response_code(403);
    exit("forbidden\n");
}
register_shutdown_function(static function () {
    $e = error_get_last();
    if ($e) {
        echo "\nFATAL:\n" . print_r($e, true);
    }
});
require __DIR__ . '/wp-load.php';
echo "wp-load OK\n";
echo 'WP ' . get_bloginfo('version') . "\n";
foreach (get_mu_plugins() as $file => $meta) {
    echo '- ' . $file . ' (' . ($meta['Name'] ?? '') . ")\n";
}
