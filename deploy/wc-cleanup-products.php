<?php
/**
 * Trash WooCommerce products whose SKU matches /^TZ-/.
 *
 * Usage:
 *   ?key=...&dry_run=1   preview
 *   ?key=...             apply
 */
require __DIR__ . '/wp-load.php';
header('Content-Type: application/json; charset=utf-8');

$expectedKey = 'ybb-migrate-20260624';
if (($_GET['key'] ?? '') !== $expectedKey) {
    http_response_code(403);
    exit(json_encode(['error' => 'forbidden']));
}

$dryRun = isset($_GET['dry_run']);

$report = [
    'dryRun' => $dryRun,
    'trashed' => 0,
    'errors' => [],
];

if (!function_exists('wc_get_products')) {
    http_response_code(500);
    $report['errors'][] = 'WooCommerce not loaded';
    echo json_encode($report, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    exit;
}

$products = wc_get_products([
    'limit' => -1,
    'status' => ['publish', 'draft', 'private', 'pending', 'future'],
    'return' => 'objects',
]);

foreach ($products as $product) {
    $sku = trim((string) $product->get_sku());
    if ($sku === '' || !preg_match('/^TZ-/', $sku)) {
        continue;
    }

    if ($dryRun) {
        $report['trashed']++;
        continue;
    }

    try {
        $deleted = $product->delete(false);
        if ($deleted) {
            $report['trashed']++;
        } else {
            $report['errors'][] = "trash {$sku} (id {$product->get_id()}): delete returned false";
        }
    } catch (Throwable $e) {
        $report['errors'][] = "trash {$sku} (id {$product->get_id()}): " . $e->getMessage();
    }
}

echo json_encode($report, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
