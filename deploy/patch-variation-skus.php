<?php
/**
 * Patch WooCommerce variation SKUs from variation-sku-patch.json in public_html.
 *
 * Usage:
 *   ?key=ybb-migrate-20260624&dry_run=1   preview
 *   ?key=ybb-migrate-20260624             apply
 */
require __DIR__ . '/wp-load.php';
header('Content-Type: application/json; charset=utf-8');

$expectedKey = 'ybb-migrate-20260624';
if (($_GET['key'] ?? '') !== $expectedKey) {
    http_response_code(403);
    exit(json_encode(['error' => 'forbidden']));
}

$dryRun = isset($_GET['dry_run']);
$patchPath = __DIR__ . '/variation-sku-patch.json';

$report = [
    'dryRun' => $dryRun,
    'updated' => 0,
    'skipped' => 0,
    'errors' => [],
    'details' => [],
];

if (!is_file($patchPath)) {
    http_response_code(404);
    exit(json_encode(['error' => 'missing variation-sku-patch.json in public_html']));
}

$payload = json_decode(file_get_contents($patchPath), true);
$patches = is_array($payload['patches'] ?? null) ? $payload['patches'] : [];
if (!$patches) {
    exit(json_encode(['error' => 'empty patches array', 'dryRun' => $dryRun]));
}

foreach ($patches as $patch) {
    $variationId = (int) ($patch['variationWcId'] ?? 0);
    $targetSku = trim((string) ($patch['targetSku'] ?? ''));
    $parentSku = trim((string) ($patch['parentSku'] ?? ''));

    if ($variationId <= 0 || $targetSku === '') {
        $report['errors'][] = [
            'parentSku' => $parentSku,
            'message' => 'invalid variationWcId or targetSku',
            'patch' => $patch,
        ];
        continue;
    }

    $product = wc_get_product($variationId);
    if (!$product || !$product->is_type('variation')) {
        $report['errors'][] = [
            'parentSku' => $parentSku,
            'variationWcId' => $variationId,
            'message' => 'variation not found or wrong type',
        ];
        continue;
    }

    $currentSku = trim((string) $product->get_sku());
    if ($currentSku === $targetSku) {
        $report['skipped']++;
        $report['details'][] = [
            'variationWcId' => $variationId,
            'parentSku' => $parentSku,
            'action' => 'skipped',
            'sku' => $targetSku,
        ];
        continue;
    }

    $conflictId = wc_get_product_id_by_sku($targetSku);
    if ($conflictId > 0 && $conflictId !== $variationId) {
        $report['errors'][] = [
            'parentSku' => $parentSku,
            'variationWcId' => $variationId,
            'targetSku' => $targetSku,
            'message' => "sku conflict with product id {$conflictId}",
        ];
        continue;
    }

    if ($dryRun) {
        $report['updated']++;
        $report['details'][] = [
            'variationWcId' => $variationId,
            'parentSku' => $parentSku,
            'action' => 'would_update',
            'from' => $currentSku,
            'to' => $targetSku,
        ];
        continue;
    }

    try {
        $product->set_sku($targetSku);
        $savedId = $product->save();
        if ($savedId !== $variationId) {
            throw new RuntimeException("save returned {$savedId}");
        }
        $report['updated']++;
        $report['details'][] = [
            'variationWcId' => $variationId,
            'parentSku' => $parentSku,
            'action' => 'updated',
            'from' => $currentSku,
            'to' => $targetSku,
        ];
    } catch (Throwable $e) {
        $report['errors'][] = [
            'parentSku' => $parentSku,
            'variationWcId' => $variationId,
            'targetSku' => $targetSku,
            'message' => $e->getMessage(),
        ];
    }
}

echo json_encode($report, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
