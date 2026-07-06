<?php
/**
 * Mark homepage hot-product parent SKUs as WooCommerce featured (starred).
 * Matches lib/data/hot-products.json on the Next.js frontend.
 *
 * Upload hot-products.json to public_html/ then run:
 * https://carp-ybb.com/sync-wc-hot-products.php?key=ybb-migrate-20260624&nocache=1
 * Delete after use.
 */
require __DIR__ . '/wp-load.php';
header('Content-Type: application/json; charset=utf-8');

$expectedKey = 'ybb-migrate-20260624';
if (($_GET['key'] ?? '') !== $expectedKey) {
    http_response_code(403);
    exit(json_encode(['error' => 'forbidden']));
}

$jsonPath = __DIR__ . '/hot-products.json';
if (!is_readable($jsonPath)) {
    http_response_code(400);
    exit(json_encode(['error' => 'missing hot-products.json in public_html']));
}

$config = json_decode(file_get_contents($jsonPath), true);
$handles = $config['handles'] ?? [];
if (!is_array($handles) || !$handles) {
    exit(json_encode(['error' => 'empty handles list']));
}

if (!function_exists('wc_get_products')) {
    exit(json_encode(['error' => 'WooCommerce not loaded']));
}

$report = ['featured' => [], 'not_found' => [], 'errors' => []];

// Clear existing featured flags first
$all_featured = wc_get_products(['status' => 'publish', 'featured' => true, 'limit' => -1, 'return' => 'ids']);
foreach ($all_featured as $pid) {
    $p = wc_get_product($pid);
    if ($p) {
        $p->set_featured(false);
        $p->save();
    }
}

function wc_hot_parent_sku_from_handle(string $handle): string
{
    return strtoupper(str_replace('-', '-', $handle));
}

function wc_hot_find_parent_product(string $handle): ?WC_Product
{
    $sku = wc_hot_parent_sku_from_handle($handle);

    $ids = wc_get_products([
        'status' => 'publish',
        'sku' => $sku,
        'limit' => 1,
        'return' => 'ids',
    ]);

    if ($ids) {
        $product = wc_get_product($ids[0]);
        return $product instanceof WC_Product ? $product : null;
    }

    $posts = get_posts([
        'post_type' => 'product',
        'name' => $handle,
        'posts_per_page' => 1,
        'post_status' => 'publish',
    ]);
    if ($posts) {
        $product = wc_get_product($posts[0]->ID);
        return $product instanceof WC_Product ? $product : null;
    }

    return null;
}

foreach ($handles as $handle) {
    $product = wc_hot_find_parent_product($handle);
    if (!$product) {
        $report['not_found'][] = $handle;
        continue;
    }

    if ($product->get_type() === 'variation') {
        $parent = wc_get_product($product->get_parent_id());
        if ($parent instanceof WC_Product) {
            $product = $parent;
        }
    }

    $product->set_featured(true);
    $product->save();
    $report['featured'][] = [
        'handle' => $handle,
        'id' => $product->get_id(),
        'sku' => $product->get_sku(),
        'type' => $product->get_type(),
    ];
}

echo json_encode($report, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
