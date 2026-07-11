<?php
/**
 * One-off mu-plugin syntax probe. Delete after use.
 * Usage: https://carp-ybb.com/ybb-sm-diagnose.php?key=ybb-migrate-20260624
 */
declare(strict_types=1);

$key = (string) ($_GET['key'] ?? '');
if ($key !== 'ybb-migrate-20260624') {
    http_response_code(403);
    exit('forbidden');
}

header('Content-Type: text/plain; charset=utf-8');

$root = __DIR__ . '/wp-content/mu-plugins/ybb-site-manager';
$targets = [
    'ybb-site-manager.php',
    'includes/modules/audit-log.php',
    'includes/modules/deploy-queue.php',
    'includes/modules/navigation.php',
    'includes/modules/pdp.php',
    'includes/modules/products.php',
    'includes/class-rest.php',
    'includes/admin/tab-products.php',
    'includes/admin/page.php',
];

foreach ($targets as $rel) {
    $path = $root . '/' . $rel;
    if (!is_file($path)) {
        echo "MISSING {$rel}\n";
        continue;
    }
    $code = (string) file_get_contents($path);
    try {
        token_get_all($code, TOKEN_PARSE);
        echo "OK {$rel} (" . strlen($code) . " bytes)\n";
    } catch (ParseError $e) {
        echo "PARSE {$rel}: {$e->getMessage()} @ line {$e->getLine()}\n";
    }
}

echo "\n--- wp-load ---\n";
require __DIR__ . '/wp-load.php';
echo "wp-load OK\n";

if (function_exists('ybb_sm_product_live_payload')) {
    $payload = ybb_sm_product_live_payload('tz-hk-001');
    echo 'product-live keys: ' . implode(', ', array_keys(is_array($payload) ? $payload : [])) . "\n";
    if (is_array($payload) && isset($payload['pdpTabLabels'])) {
        echo "pdpTabLabels.description.zh=" . ($payload['pdpTabLabels']['description']['zh'] ?? '') . "\n";
    }
} else {
    echo "ybb_sm_product_live_payload missing\n";
}
