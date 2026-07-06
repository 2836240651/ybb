<?php
/**
 * Audit WooCommerce product types (simple vs variable vs variation).
 * Run: https://carp-ybb.com/wc-product-type-audit.php?key=ybb-migrate-20260624&nocache=1
 */
require __DIR__ . '/wp-load.php';
header('Content-Type: application/json; charset=utf-8');

$expectedKey = 'ybb-migrate-20260624';
if (($_GET['key'] ?? '') !== $expectedKey) {
    http_response_code(403);
    exit(json_encode(['error' => 'forbidden']));
}

if (!function_exists('wc_get_products')) {
    exit(json_encode(['error' => 'WooCommerce not loaded']));
}

$typeCounts = [
    'simple' => 0,
    'variable' => 0,
    'variation' => 0,
    'grouped' => 0,
    'external' => 0,
    'other' => 0,
];

$parentSkuGroups = [];
$sampleSimpleVariants = [];

foreach (['publish', 'draft', 'private'] as $status) {
    $page = 1;
    while (true) {
        $batch = wc_get_products([
            'limit' => 100,
            'page' => $page,
            'status' => $status,
            'return' => 'objects',
        ]);
        if (!$batch) {
            break;
        }
        foreach ($batch as $product) {
            $type = $product->get_type();
            if (!isset($typeCounts[$type])) {
                $typeCounts['other']++;
            } else {
                $typeCounts[$type]++;
            }

            if ($type === 'simple') {
                $sku = trim((string) $product->get_sku());
                $parentMeta = trim((string) get_post_meta($product->get_id(), '_parent_sku', true));
                $groupKey = $parentMeta !== '' ? $parentMeta : null;
                if ($groupKey === null && preg_match('/^(TZ-[A-Z]+-\d+)/', $sku, $m)) {
                    $groupKey = $m[1];
                }
                if ($groupKey) {
                    $parentSkuGroups[$groupKey] = ($parentSkuGroups[$groupKey] ?? 0) + 1;
                }
                if (count($sampleSimpleVariants) < 8) {
                    $sampleSimpleVariants[] = [
                        'id' => $product->get_id(),
                        'sku' => $sku,
                        'name' => $product->get_name(),
                        'parentMeta' => $parentMeta,
                        'inferredParent' => $groupKey,
                    ];
                }
            }
        }
        if (count($batch) < 100) {
            break;
        }
        $page++;
    }
}

$multiVariantParents = array_filter($parentSkuGroups, static fn($c) => $c > 1);
arsort($multiVariantParents);

$variableSamples = [];
$variables = wc_get_products(['limit' => 5, 'type' => 'variable', 'status' => 'publish', 'return' => 'objects']);
foreach ($variables as $vp) {
    $variableSamples[] = [
        'id' => $vp->get_id(),
        'sku' => $vp->get_sku(),
        'name' => $vp->get_name(),
        'variationCount' => count($vp->get_children()),
    ];
}

echo json_encode([
    'typeCounts' => $typeCounts,
    'totalProducts' => array_sum($typeCounts),
    'parentsWithMultipleSimpleChildren' => count($multiVariantParents),
    'topMultiVariantParents' => array_slice($multiVariantParents, 0, 10, true),
    'variableProductSamples' => $variableSamples,
    'sampleSimpleVariants' => $sampleSimpleVariants,
    'diagnosis' => $typeCounts['variable'] === 0 && $typeCounts['variation'] === 0
        ? 'All variants are standalone simple products �?no WooCommerce variable parents.'
        : 'Mixed or variable catalog present.',
], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
