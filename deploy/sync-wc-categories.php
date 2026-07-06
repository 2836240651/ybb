<?php
/**
 * Sync WooCommerce product_cat to frontend / Excel taxonomy.
 * Preserves: product_brand, product_tag, all pa_* attributes.
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
$jsonPath = __DIR__ . '/wc-category-sync.json';
if (!is_file($jsonPath)) {
    http_response_code(404);
    exit(json_encode(['error' => 'missing wc-category-sync.json in public_html']));
}

$payload = json_decode(file_get_contents($jsonPath), true);
if (!is_array($payload)) {
    http_response_code(500);
    exit(json_encode(['error' => 'invalid json']));
}

$report = [
    'dryRun' => $dryRun,
    'termsCreated' => 0,
    'termsUpdated' => 0,
    'termsSkipped' => 0,
    'legacyRemoved' => 0,
    'productsReassigned' => 0,
    'productsUnmatched' => 0,
    'errors' => [],
    'unmatchedSkus' => [],
];

/** @var array<string,int> slug -> term_id */
$slugToId = [];

function wc_sync_display_name(array $term): string
{
    $locale = get_locale();
    if (str_starts_with($locale, 'zh') && !empty($term['nameZh'])) {
        return $term['nameZh'];
    }
    return $term['nameEn'] ?? $term['nameZh'] ?? $term['slug'];
}

function wc_sync_get_term_by_slug(string $slug): ?WP_Term
{
    $t = get_term_by('slug', $slug, 'product_cat');
    return $t instanceof WP_Term ? $t : null;
}

// Index existing product_cat by slug
$existing = get_terms([
    'taxonomy' => 'product_cat',
    'hide_empty' => false,
    'number' => 0,
]);
if (!is_wp_error($existing)) {
    foreach ($existing as $t) {
        $slugToId[$t->slug] = (int) $t->term_id;
    }
}

// Topological insert: parents before children
$terms = $payload['terms'] ?? [];
$pending = $terms;
$guard = 0;
while ($pending && $guard < count($terms) + 5) {
    $guard++;
    $next = [];
    foreach ($pending as $term) {
        $slug = $term['slug'];
        $parentSlug = $term['parent'] ?? null;
        $parentId = 0;
        if ($parentSlug) {
            if (!isset($slugToId[$parentSlug])) {
                $next[] = $term;
                continue;
            }
            $parentId = $slugToId[$parentSlug];
        }

        $name = wc_sync_display_name($term);
        if (isset($slugToId[$slug])) {
            $termId = $slugToId[$slug];
            $existingTerm = get_term($termId, 'product_cat');
            if ($existingTerm && !$dryRun) {
                if ($existingTerm->name !== $name || (int) $existingTerm->parent !== $parentId) {
                    wp_update_term($termId, 'product_cat', [
                        'name' => $name,
                        'parent' => $parentId,
                        'slug' => $slug,
                    ]);
                    $report['termsUpdated']++;
                } else {
                    $report['termsSkipped']++;
                }
            } else {
                $report['termsSkipped']++;
            }
            continue;
        }

        if ($dryRun) {
            $slugToId[$slug] = -1;
            $report['termsCreated']++;
            continue;
        }

        $result = wp_insert_term($name, 'product_cat', [
            'slug' => $slug,
            'parent' => $parentId,
        ]);
        if (is_wp_error($result)) {
            if ($result->get_error_code() === 'term_exists') {
                $existingId = (int) ($result->get_error_data()['term_id'] ?? 0);
                if ($existingId > 0) {
                    $slugToId[$slug] = $existingId;
                    $report['termsSkipped']++;
                    continue;
                }
            }
            $existingTerm = wc_sync_get_term_by_slug($slug);
            if ($existingTerm) {
                $slugToId[$slug] = (int) $existingTerm->term_id;
                $report['termsSkipped']++;
                continue;
            }
            $report['errors'][] = "insert {$slug}: " . $result->get_error_message();
            continue;
        }
        $slugToId[$slug] = (int) $result['term_id'];
        $report['termsCreated']++;
    }
    $pending = $next;
}

// Reassign products by SKU base (TZ-QZ-001) from variable parent SKU
$skuMap = $payload['skuToCategorySlugs'] ?? [];
$prefixFallback = $payload['skuPrefixFallback'] ?? [];
if (!function_exists('wc_get_products')) {
    $report['errors'][] = 'WooCommerce not loaded';
    echo json_encode($report, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    exit;
}

$products = wc_get_products([
    'limit' => -1,
    'status' => ['publish', 'draft', 'private'],
    'return' => 'objects',
]);

foreach ($products as $product) {
    $sku = trim((string) $product->get_sku());
    if ($sku === '') {
        $report['productsUnmatched']++;
        continue;
    }

    // Match TZ-XX-NNN from TZ-XX-NNN-spec or exact base
  $base = $sku;
    if (preg_match('/^(TZ-[A-Z]+-\d+)/', $sku, $m)) {
        $base = $m[1];
    }

    if (!isset($skuMap[$base])) {
        $prefixKey = null;
        if (preg_match('/^(TZ-[^-]+)/', $sku, $pm)) {
            $prefixKey = $pm[1];
        }
        if ($prefixKey && isset($prefixFallback[$prefixKey])) {
            $path = $prefixFallback[$prefixKey];
        } else {
            $report['productsUnmatched']++;
            if (count($report['unmatchedSkus']) < 30) {
                $report['unmatchedSkus'][] = $sku;
            }
            continue;
        }
    } else {
        $path = $skuMap[$base];
    }
    $termIds = [];
    foreach ($path as $slug) {
        if (isset($slugToId[$slug]) && $slugToId[$slug] > 0) {
            $termIds[] = $slugToId[$slug];
            continue;
        }
        $existingTerm = wc_sync_get_term_by_slug($slug);
        if ($existingTerm) {
            $slugToId[$slug] = (int) $existingTerm->term_id;
            $termIds[] = (int) $existingTerm->term_id;
        }
    }
    $termIds = array_values(array_unique($termIds));
    if (!$termIds) {
        $report['productsUnmatched']++;
        continue;
    }

    if (!$dryRun) {
        wp_set_object_terms($product->get_id(), $termIds, 'product_cat', false);
    }
    $report['productsReassigned']++;
}

// Remove legacy WoodMart categories (deepest first)
$legacy = $payload['removeLegacySlugs'] ?? [];
usort($legacy, fn($a, $b) => strlen($b) <=> strlen($a));
foreach ($legacy as $legacySlug) {
    $term = wc_sync_get_term_by_slug($legacySlug);
    if (!$term) {
        continue;
    }
    if ($dryRun) {
        $report['legacyRemoved']++;
        continue;
    }
    $deleted = wp_delete_term($term->term_id, 'product_cat');
    if (!is_wp_error($deleted)) {
        $report['legacyRemoved']++;
    } else {
        $report['errors'][] = "delete legacy {$legacySlug}: " . $deleted->get_error_message();
    }
}

$report['termSlugsActive'] = count(array_filter($slugToId, fn($id) => $id > 0));
echo json_encode($report, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
