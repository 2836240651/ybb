<?php
/** One-time: remove migration artifacts from public_html */
require __DIR__ . '/wp-load.php';
header('Content-Type: application/json; charset=utf-8');
if (($_GET['key'] ?? '') !== 'ybb-migrate-20260624') {
    http_response_code(403);
    exit('{}');
}
$files = [
    'wc-debug-hk.php',
    'wc-debug-hk2.php',
    'wc-debug-sync-logic.php',
    'wc-fix-hk.php',
    'wc-assign-hk.php',
    'wc-term-count.php',
    'wc-list-hk-loop.php',
    'wc-sku-prefixes.php',
    'wc-taxonomy-audit.php',
    'sync-wc-categories.php',
    'wc-category-sync.json',
    'wc-cleanup-products.php',
    'sync-wc-products.php',
    'wc-cleanup-migration.php',
];
$removed = [];
foreach ($files as $f) {
    $path = __DIR__ . '/' . $f;
    if (is_file($path) && @unlink($path)) {
        $removed[] = $f;
    }
}
echo json_encode(['removed' => $removed], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
