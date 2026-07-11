<?php
header('Content-Type: text/plain; charset=utf-8');
if (($_GET['key'] ?? '') !== 'ybb-migrate-20260624') {
    http_response_code(403);
    exit("forbidden\n");
}
$f = __DIR__ . '/wp-content/mu-plugins/ybb-site-manager/includes/admin/page.php';
echo "mtime=" . date('c', filemtime($f)) . "\n";
echo "size=" . filesize($f) . "\n";
$lines = file($f);
for ($i = 55; $i <= 65; $i++) {
    echo $i . ': ' . rtrim($lines[$i - 1] ?? '') . "\n";
}
for ($i = 580; $i <= 590; $i++) {
    echo $i . ': ' . rtrim($lines[$i - 1] ?? '') . "\n";
}
if (function_exists('opcache_invalidate')) {
    opcache_invalidate($f, true);
    echo "opcache invalidated\n";
}
