<?php
/**
 * Clear frontHidden for one or more catalog handles (no WP login required).
 *
 * Usage (upload to public_html, delete after use):
 *   ?key=ybb-migrate-20260624&handles=tz-qz-002&dry_run=1
 *   ?key=ybb-migrate-20260624&handles=tz-qz-002
 *   ?key=ybb-migrate-20260624&handles=tz-qz-002,tz-hk-001
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
$handles = array_values(array_filter(array_map(
    static fn ($h) => sanitize_title(trim($h)),
    explode(',', (string) ($_GET['handles'] ?? 'tz-qz-002'))
)));

$report = [
    'dryRun' => $dryRun,
    'handles' => $handles,
    'unhidden' => [],
    'missing' => [],
    'errors' => [],
];

if (!function_exists('ybb_sm_product_overrides_all') || !function_exists('ybb_sm_product_overrides_save')) {
    http_response_code(500);
    $report['errors'][] = 'YBB Site Manager not loaded';
    echo json_encode($report, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    exit;
}

$overrides = ybb_sm_product_overrides_all();
$changed = false;

foreach ($handles as $handle) {
    if ($handle === '') {
        continue;
    }
    if (!isset($overrides[$handle])) {
        $report['missing'][] = $handle;
        continue;
    }
    if (empty($overrides[$handle]['frontHidden'])) {
        $report['unhidden'][] = ['handle' => $handle, 'status' => 'already-visible'];
        continue;
    }
    if ($dryRun) {
        $report['unhidden'][] = ['handle' => $handle, 'status' => 'would-unhide'];
        continue;
    }

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
    $report['unhidden'][] = ['handle' => $handle, 'status' => 'unhidden'];
}

if (!$dryRun && $changed) {
    ybb_sm_product_overrides_save($overrides);
    if (function_exists('opcache_invalidate') && defined('YBB_SM_DIR')) {
        foreach (glob(YBB_SM_DIR . '/includes/modules/*.php') ?: [] as $php) {
            opcache_invalidate($php, true);
        }
    }
}

echo json_encode($report, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
