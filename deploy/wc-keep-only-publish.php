<?php
/**
 * Publish whitelist handles only; draft all other parent products.
 *
 * Matching (same as site-manager): SKU TZ-HK-001, slug tz-hk-001, or slug suffix.
 *
 * Usage (upload to public_html root, delete after use):
 *   ?key=ybb-migrate-20260624&dry_run=1   preview
 *   ?key=ybb-migrate-20260624             apply
 */
require __DIR__ . '/wp-load.php';
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');

$expectedKey = 'ybb-migrate-20260624';
if (($_GET['key'] ?? '') !== $expectedKey) {
    http_response_code(403);
    exit(json_encode(['error' => 'forbidden'], JSON_UNESCAPED_UNICODE));
}

$dryRun = isset($_GET['dry_run']);
$keepHandles = [
    'tz-hk-001',
    'tz-xz-004',
    'tz-xz-014',
    'tz-eldz-013',
    'tz-zj-002',
];

$report = [
    'dryRun' => $dryRun,
    'keepHandles' => $keepHandles,
    'keptPublish' => [],
    'notFound' => [],
    'drafted' => [],
    'skipped' => [],
    'errors' => [],
];

if (!function_exists('wc_get_products')) {
    http_response_code(500);
    $report['errors'][] = 'WooCommerce not loaded';
    echo json_encode($report, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    exit;
}

/**
 * @return array{product: WC_Product, matchedBy: string}|null
 */
function ybb_keep_only_find_wc_by_handle(string $handle): ?array
{
    $handle = sanitize_title($handle);
    if ($handle === '') {
        return null;
    }

    $statuses = ['publish', 'draft', 'private', 'pending', 'future'];
    $sku = strtoupper($handle);

    foreach ($statuses as $status) {
        $ids = wc_get_products([
            'status' => $status,
            'sku' => $sku,
            'limit' => 1,
            'return' => 'ids',
        ]);
        if ($ids) {
            $product = wc_get_product($ids[0]);
            if ($product instanceof WC_Product) {
                if ($product->get_type() === 'variation' && $product->get_parent_id()) {
                    $parent = wc_get_product($product->get_parent_id());
                    $product = $parent instanceof WC_Product ? $parent : $product;
                }

                return ['product' => $product, 'matchedBy' => 'sku:' . $sku];
            }
        }
    }

    $posts = get_posts([
        'post_type' => 'product',
        'name' => $handle,
        'posts_per_page' => 1,
        'post_status' => $statuses,
    ]);
    if ($posts) {
        $product = wc_get_product($posts[0]->ID);
        if ($product instanceof WC_Product) {
            return ['product' => $product, 'matchedBy' => 'slug:' . $handle];
        }
    }

    $parents = wc_get_products([
        'limit' => -1,
        'status' => $statuses,
        'type' => ['simple', 'variable', 'grouped', 'external'],
        'return' => 'objects',
    ]);
    foreach ($parents as $product) {
        if (!$product instanceof WC_Product) {
            continue;
        }
        $slug = sanitize_title((string) $product->get_slug());
        $skuNorm = sanitize_title(strtolower(trim((string) $product->get_sku())));
        if ($slug === $handle || $skuNorm === $handle) {
            return ['product' => $product, 'matchedBy' => 'scan:' . ($slug === $handle ? 'slug' : 'skuNorm')];
        }
        if ($slug !== '' && (str_ends_with($slug, $handle) || str_ends_with($slug, '-' . $handle))) {
            return ['product' => $product, 'matchedBy' => 'scan:slug-suffix'];
        }
    }

    return null;
}

$keepIds = [];

foreach ($keepHandles as $handle) {
    $found = ybb_keep_only_find_wc_by_handle($handle);
    if (!$found) {
        $report['notFound'][] = $handle;
        continue;
    }

    $product = $found['product'];
    $wcId = (int) $product->get_id();
    $keepIds[$wcId] = true;
    $status = (string) $product->get_status();

    if ($status !== 'publish') {
        if (!$dryRun) {
            $product->set_status('publish');
            $product->save();
        }
        $action = 'set-publish';
    } else {
        $action = 'already-publish';
    }

    $report['keptPublish'][] = [
        'handle' => $handle,
        'wcId' => $wcId,
        'sku' => trim((string) $product->get_sku()),
        'slug' => sanitize_title((string) $product->get_slug()),
        'matchedBy' => $found['matchedBy'],
        'action' => $action,
        'from' => $status,
    ];
}

$products = wc_get_products([
    'limit' => -1,
    'status' => ['publish', 'draft', 'private', 'pending', 'future'],
    'type' => ['simple', 'variable', 'grouped', 'external'],
    'return' => 'objects',
]);

foreach ($products as $product) {
    if (!$product instanceof WC_Product) {
        continue;
    }

    $wcId = (int) $product->get_id();
    if (isset($keepIds[$wcId])) {
        continue;
    }

    $slug = sanitize_title((string) $product->get_slug());
    $sku = trim((string) $product->get_sku());
    $status = (string) $product->get_status();

    if ($status === 'draft') {
        $report['skipped'][] = ['wcId' => $wcId, 'slug' => $slug, 'sku' => $sku, 'reason' => 'already-draft'];
        continue;
    }

    if ($dryRun) {
        $report['drafted'][] = ['wcId' => $wcId, 'slug' => $slug, 'sku' => $sku, 'from' => $status];
        continue;
    }

    try {
        $product->set_status('draft');
        $product->save();
        $report['drafted'][] = ['wcId' => $wcId, 'slug' => $slug, 'sku' => $sku, 'from' => $status];
    } catch (Throwable $e) {
        $report['errors'][] = "draft {$slug} ({$wcId}): " . $e->getMessage();
    }
}

$report['summary'] = [
    'kept' => count($report['keptPublish']),
    'notFound' => count($report['notFound']),
    'drafted' => count($report['drafted']),
    'skipped' => count($report['skipped']),
    'errors' => count($report['errors']),
];

echo json_encode($report, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
