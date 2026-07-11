<?php
/**
 * Site Manager: frontHidden=true for all catalog handles except whitelist.
 * Whitelist handles get frontHidden cleared.
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
    'tz-qz-002',
    // 2026-07 batch publish
    'tz-eldz-001',
    'tz-eldz-002',
    'tz-qzdz-001',
    'tz-qzdz-002',
    'tz-qzdz-003',
    'tz-qz-010',
    'tz-qz-011',
];
$keepSet = array_fill_keys($keepHandles, true);

$report = [
    'dryRun' => $dryRun,
    'keepHandles' => $keepHandles,
    'hidden' => [],
    'unhidden' => [],
    'errors' => [],
];

if (!function_exists('wc_get_products') || !function_exists('ybb_sm_product_overrides_all')) {
    http_response_code(500);
    $report['errors'][] = 'YBB Site Manager or WooCommerce not loaded';
    echo json_encode($report, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    exit;
}

function ybb_front_visible_find_wc_by_handle(string $handle): ?WC_Product
{
    if (function_exists('ybb_keep_only_find_wc_by_handle')) {
        $found = ybb_keep_only_find_wc_by_handle($handle);
        return $found ? $found['product'] : null;
    }

    $handle = sanitize_title($handle);
    if ($handle === '' || !function_exists('wc_get_products')) {
        return null;
    }

    $sku = strtoupper($handle);
    foreach (['publish', 'draft', 'private', 'pending'] as $status) {
        $ids = wc_get_products([
            'status' => $status,
            'sku' => $sku,
            'limit' => 1,
            'return' => 'ids',
        ]);
        if ($ids) {
            $product = wc_get_product($ids[0]);
            return $product instanceof WC_Product ? $product : null;
        }
    }

    return null;
}

function ybb_front_visible_resolve_handle(WC_Product $product): string
{
    $sku = trim((string) $product->get_sku());
    if ($sku !== '') {
        return sanitize_title(strtolower($sku));
    }
    $slug = sanitize_title((string) $product->get_slug());
    if ($slug !== '') {
        return $slug;
    }

    return '';
}

$products = wc_get_products([
    'limit' => -1,
    'status' => ['publish', 'draft', 'private'],
    'type' => ['simple', 'variable', 'grouped', 'external'],
    'return' => 'objects',
]);

$overrides = ybb_sm_product_overrides_all();
$changed = false;

foreach ($keepHandles as $keepHandle) {
    $product = ybb_front_visible_find_wc_by_handle($keepHandle);
    if (!$product instanceof WC_Product) {
        continue;
    }
    $handle = $keepHandle;
    if (isset($overrides[$handle]) && !empty($overrides[$handle]['frontHidden'])) {
        if ($dryRun) {
            $report['unhidden'][] = $handle;
        } else {
            $row = is_array($overrides[$handle]) ? $overrides[$handle] : [];
            $row['frontHidden'] = false;
            $row['updatedAt'] = gmdate('c');
            $hasOther = trim((string) ($row['titleZh'] ?? '')) !== ''
                || trim((string) ($row['titleJa'] ?? '')) !== ''
                || trim((string) ($row['descriptionZh'] ?? '')) !== ''
                || trim((string) ($row['descriptionJa'] ?? '')) !== ''
                || !empty($row['hideDescription'])
                || !empty($row['hideAdditionalInfo'])
                || trim((string) ($row['sloganEn'] ?? '')) !== ''
                || trim((string) ($row['sloganZh'] ?? '')) !== ''
                || trim((string) ($row['sloganJa'] ?? '')) !== ''
                || !empty($row['hideSlogan']);
            if ($hasOther) {
                $overrides[$handle] = $row;
            } else {
                unset($overrides[$handle]);
            }
            $changed = true;
            $report['unhidden'][] = $handle;
        }
    }
}

foreach ($products as $product) {
    if (!$product instanceof WC_Product) {
        continue;
    }

    $handle = ybb_front_visible_resolve_handle($product);
    if ($handle === '' || isset($keepSet[$handle])) {
        continue;
    }

    // Also skip if this WC product is one of the whitelist parents (by SKU lookup).
    $isKept = false;
    foreach ($keepHandles as $keepHandle) {
        $keptProduct = ybb_front_visible_find_wc_by_handle($keepHandle);
        if ($keptProduct instanceof WC_Product && (int) $keptProduct->get_id() === (int) $product->get_id()) {
            $isKept = true;
            break;
        }
    }
    if ($isKept) {
        continue;
    }

    $row = is_array($overrides[$handle] ?? null) ? $overrides[$handle] : [];
    if (!empty($row['frontHidden'])) {
        continue;
    }

    if ($dryRun) {
        $report['hidden'][] = $handle;
        continue;
    }

    $row['frontHidden'] = true;
    $row['updatedAt'] = gmdate('c');
    $overrides[$handle] = array_merge([
        'titleZh' => '',
        'titleJa' => '',
        'descriptionZh' => '',
        'descriptionJa' => '',
        'hideDescription' => false,
        'hideAdditionalInfo' => false,
        'sloganEn' => '',
        'sloganZh' => '',
        'sloganJa' => '',
        'hideSlogan' => false,
    ], $row);
    $changed = true;
    $report['hidden'][] = $handle;
}

if (!$dryRun && $changed && function_exists('ybb_sm_product_overrides_save')) {
    ybb_sm_product_overrides_save($overrides);
    if (function_exists('opcache_invalidate') && defined('YBB_SM_DIR')) {
        foreach (glob(YBB_SM_DIR . '/includes/modules/*.php') ?: [] as $php) {
            opcache_invalidate($php, true);
        }
    }
}

$report['summary'] = [
    'hidden' => count($report['hidden']),
    'unhidden' => count($report['unhidden']),
    'errors' => count($report['errors']),
];

echo json_encode($report, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
