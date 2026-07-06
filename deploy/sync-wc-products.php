<?php
/**
 * Upsert WooCommerce variable/simple products from product-import/wc-catalog.json.
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
$importDir = __DIR__ . '/product-import';
$manifestPath = $importDir . '/manifest.json';
$catalogPath = $importDir . '/wc-catalog.json';
$idMapPath = $importDir . '/wc-id-map.json';

$report = [
    'dryRun' => $dryRun,
    'parentsCreated' => 0,
    'parentsUpdated' => 0,
    'variationsCreated' => 0,
    'variationsUpdated' => 0,
    'simpleCreated' => 0,
    'simpleUpdated' => 0,
    'skipped' => 0,
    'errors' => [],
    'translationWarnings' => [],
];

if (!is_file($manifestPath)) {
    http_response_code(404);
    exit(json_encode(['error' => 'missing product-import/manifest.json in public_html']));
}
if (!is_file($catalogPath)) {
    http_response_code(404);
    exit(json_encode(['error' => 'missing product-import/wc-catalog.json in public_html']));
}

$manifest = json_decode(file_get_contents($manifestPath), true);
$catalog = json_decode(file_get_contents($catalogPath), true);
if (!is_array($manifest) || !is_array($catalog) || !is_array($catalog['products'] ?? null)) {
    http_response_code(500);
    exit(json_encode(['error' => 'invalid manifest.json or wc-catalog.json']));
}

if (!function_exists('wc_get_products')) {
    http_response_code(500);
    $report['errors'][] = 'WooCommerce not loaded';
    echo json_encode($report, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    exit;
}

/** @var array<string,int> slug -> term_id */
$slugToId = [];

function wc_prod_display_name(array $term): string
{
    $locale = get_locale();
    if (str_starts_with($locale, 'zh') && !empty($term['nameZh'])) {
        return $term['nameZh'];
    }
    return $term['nameEn'] ?? $term['nameZh'] ?? $term['slug'];
}

function wc_prod_get_term_by_slug(string $slug): ?WP_Term
{
    $t = get_term_by('slug', $slug, 'product_cat');
    return $t instanceof WP_Term ? $t : null;
}

function wc_prod_normalize_header(string $header): string
{
    return strtolower(preg_replace('/[^a-z0-9]+/', '', $header));
}

function wc_prod_ensure_spec_taxonomy(array $manifest, bool $dryRun): string
{
    $taxonomy = $manifest['attribute']['taxonomy'] ?? 'pa_spec';
    if (taxonomy_exists($taxonomy) || $dryRun) {
        return $taxonomy;
    }

    $slug = $manifest['attribute']['slug'] ?? 'spec';
    $name = $manifest['attribute']['name'] ?? 'Spec';

    if (function_exists('wc_create_attribute')) {
        $attrId = wc_create_attribute([
            'name' => $name,
            'slug' => $slug,
            'type' => 'select',
            'order_by' => 'menu_order',
            'has_archives' => false,
        ]);
        if (!is_wp_error($attrId)) {
            delete_transient('wc_attribute_taxonomies');
            WC_Post_Types::register_taxonomies();
        }
    }

    return taxonomy_exists($taxonomy) ? $taxonomy : $taxonomy;
}

function wc_prod_ensure_spec_term(string $taxonomy, string $spec): int
{
    $spec = trim($spec);
    if ($spec === '') {
        return 0;
    }

    $existing = get_term_by('name', $spec, $taxonomy);
    if ($existing instanceof WP_Term) {
        return (int) $existing->term_id;
    }

    $result = wp_insert_term($spec, $taxonomy, ['slug' => sanitize_title($spec)]);
    if (is_wp_error($result)) {
        if ($result->get_error_code() === 'term_exists') {
            return (int) ($result->get_error_data()['term_id'] ?? 0);
        }
        return 0;
    }

    return (int) $result['term_id'];
}

function wc_prod_bootstrap_category_index(array $categoryTerms, array &$slugToId): void
{
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

    $pending = $categoryTerms;
    $guard = 0;
    while ($pending && $guard < count($categoryTerms) + 5) {
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

            if (isset($slugToId[$slug])) {
                continue;
            }

            $existingTerm = wc_prod_get_term_by_slug($slug);
            if ($existingTerm) {
                $slugToId[$slug] = (int) $existingTerm->term_id;
                continue;
            }

            $name = wc_prod_display_name($term);
            $result = wp_insert_term($name, 'product_cat', [
                'slug' => $slug,
                'parent' => $parentId,
            ]);
            if (is_wp_error($result)) {
                if ($result->get_error_code() === 'term_exists') {
                    $existingId = (int) ($result->get_error_data()['term_id'] ?? 0);
                    if ($existingId > 0) {
                        $slugToId[$slug] = $existingId;
                        continue;
                    }
                }
                $existingTerm = wc_prod_get_term_by_slug($slug);
                if ($existingTerm) {
                    $slugToId[$slug] = (int) $existingTerm->term_id;
                }
                continue;
            }
            $slugToId[$slug] = (int) $result['term_id'];
        }
        $pending = $next;
    }
}

function wc_prod_resolve_category_ids(array $categorySlugs, array &$slugToId, array $categoryTerms, bool $dryRun): array
{
    if (!$categorySlugs) {
        return [];
    }

    $termsBySlug = [];
    foreach ($categoryTerms as $term) {
        if (!empty($term['slug'])) {
            $termsBySlug[$term['slug']] = $term;
        }
    }

    $termIds = [];
    foreach ($categorySlugs as $slug) {
        $slug = trim((string) $slug);
        if ($slug === '') {
            continue;
        }

        if (isset($slugToId[$slug]) && $slugToId[$slug] > 0) {
            $termIds[] = $slugToId[$slug];
            continue;
        }

        $existingTerm = wc_prod_get_term_by_slug($slug);
        if ($existingTerm) {
            $slugToId[$slug] = (int) $existingTerm->term_id;
            $termIds[] = (int) $existingTerm->term_id;
            continue;
        }

        if (!isset($termsBySlug[$slug])) {
            continue;
        }

        if ($dryRun) {
            $slugToId[$slug] = -1;
            $termIds[] = -1;
            continue;
        }

        $term = $termsBySlug[$slug];
        $parentSlug = $term['parent'] ?? null;
        $parentId = 0;
        if ($parentSlug) {
            if (isset($slugToId[$parentSlug]) && $slugToId[$parentSlug] > 0) {
                $parentId = $slugToId[$parentSlug];
            } else {
                $parentTerm = wc_prod_get_term_by_slug($parentSlug);
                if ($parentTerm) {
                    $slugToId[$parentSlug] = (int) $parentTerm->term_id;
                    $parentId = (int) $parentTerm->term_id;
                }
            }
        }

        $name = wc_prod_display_name($term);
        $result = wp_insert_term($name, 'product_cat', [
            'slug' => $slug,
            'parent' => $parentId,
        ]);
        if (is_wp_error($result)) {
            if ($result->get_error_code() === 'term_exists') {
                $existingId = (int) ($result->get_error_data()['term_id'] ?? 0);
                if ($existingId > 0) {
                    $slugToId[$slug] = $existingId;
                    $termIds[] = $existingId;
                }
            }
            continue;
        }

        $slugToId[$slug] = (int) $result['term_id'];
        $termIds[] = (int) $result['term_id'];
    }

    return array_values(array_unique(array_filter($termIds, fn($id) => (int) $id !== 0)));
}

function wc_prod_parent_slug(string $parentSku): string
{
    return sanitize_title(strtolower($parentSku));
}

function wc_prod_format_price(string $priceRaw, string $defaultPrice): string
{
    $price = $priceRaw !== '' ? wc_format_decimal($priceRaw) : '';
    if ($price === '' || (float) $price <= 0) {
        $price = wc_format_decimal($defaultPrice);
    }
    return $price;
}

function wc_prod_assign_categories(int $productId, array $categorySlugs, array &$slugToId, array $categoryTerms, bool $dryRun): void
{
    if (!$categorySlugs) {
        return;
    }
    $termIds = wc_prod_resolve_category_ids($categorySlugs, $slugToId, $categoryTerms, $dryRun);
    if ($termIds && !$dryRun) {
        wp_set_object_terms($productId, $termIds, 'product_cat', false);
    }
}

function wc_prod_set_spec_attribute(WC_Product $product, string $specTaxonomy, array $specValues, bool $forVariation): void
{
    if (!taxonomy_exists($specTaxonomy)) {
        return;
    }

    foreach ($specValues as $spec) {
        wc_prod_ensure_spec_term($specTaxonomy, (string) $spec);
    }

    $attrId = wc_attribute_taxonomy_id_by_name(str_replace('pa_', '', $specTaxonomy));
    if (!$attrId) {
        return;
    }

    $attribute = new WC_Product_Attribute();
    $attribute->set_id((int) $attrId);
    $attribute->set_name($specTaxonomy);
    $attribute->set_options(array_values(array_unique($specValues)));
    $attribute->set_visible(true);
    $attribute->set_variation($forVariation);
    $product->set_attributes([$attribute]);
}

function wc_prod_upsert_i18n_meta(int $productId, string $titleEn, string $titleZh, string $titleJa, array &$report, string $sku): void
{
    $resolvedEn = trim($titleEn);
    $resolvedZh = trim($titleZh) !== '' ? trim($titleZh) : $resolvedEn;
    $resolvedJa = trim($titleJa) !== '' ? trim($titleJa) : $resolvedEn;

    if (trim($titleZh) === '') {
        $report['translationWarnings'][] = ['sku' => $sku, 'field' => 'titleZh', 'fallback' => $resolvedEn];
    }
    if (trim($titleJa) === '') {
        $report['translationWarnings'][] = ['sku' => $sku, 'field' => 'titleJa', 'fallback' => $resolvedEn];
    }

    update_post_meta($productId, '_ybb_title_en', $resolvedEn);
    update_post_meta($productId, '_ybb_title_zh', $resolvedZh);
    update_post_meta($productId, '_ybb_title_ja', $resolvedJa);
}

$idMap = [
    'generatedAt' => gmdate('c'),
    'parents' => [],
    'variations' => [],
];

$categoryTerms = $manifest['categoryTerms']['terms'] ?? $manifest['categoryTerms'] ?? [];
$defaultPrice = (string) ($manifest['defaultPrice'] ?? '1.99');
if (!$dryRun) {
    wc_prod_bootstrap_category_index($categoryTerms, $slugToId);
} else {
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
}

$specTaxonomy = wc_prod_ensure_spec_taxonomy($manifest, $dryRun);
if (!$dryRun && !taxonomy_exists($specTaxonomy)) {
    $report['errors'][] = "attribute taxonomy {$specTaxonomy} unavailable";
}

foreach ($catalog['products'] as $entry) {
    $parentSku = trim((string) ($entry['parentSku'] ?? ''));
    $type = trim((string) ($entry['type'] ?? 'simple'));
    $name = trim((string) ($entry['name'] ?? ''));
    $titleZh = trim((string) ($entry['nameZh'] ?? ''));
    $titleJa = trim((string) ($entry['nameJa'] ?? ''));
    $categorySlugs = is_array($entry['categorySlugs'] ?? null) ? $entry['categorySlugs'] : [];
    $variations = is_array($entry['variations'] ?? null) ? $entry['variations'] : [];

    if ($parentSku === '' || $name === '') {
        $report['skipped']++;
        continue;
    }

    try {
        if ($type === 'simple') {
            $variantSku = trim((string) ($entry['variationSku'] ?? ($variations[0]['sku'] ?? $parentSku)));
            $spec = trim((string) ($entry['spec'] ?? ($variations[0]['spec'] ?? 'Default')));
            $price = wc_prod_format_price(
                (string) ($entry['regularPrice'] ?? ($variations[0]['price'] ?? '')),
                $defaultPrice
            );

            $existingId = wc_get_product_id_by_sku($variantSku);
            $isUpdate = $existingId > 0;

            if ($dryRun) {
                if ($isUpdate) {
                    $report['simpleUpdated']++;
                } else {
                    $report['simpleCreated']++;
                }
                $idMap['parents'][$parentSku] = ['id' => $existingId ?: 0, 'type' => 'simple', 'sku' => $variantSku];
                $idMap['variations'][$variantSku] = ['id' => $existingId ?: 0, 'parentSku' => $parentSku];
                continue;
            }

            if ($isUpdate) {
                $product = wc_get_product($existingId);
                if (!$product || !($product instanceof WC_Product)) {
                    $report['errors'][] = "load simple {$variantSku} failed";
                    $report['skipped']++;
                    continue;
                }
                if ($product->get_type() !== 'simple') {
                    $report['errors'][] = "sku {$variantSku} exists as non-simple";
                    $report['skipped']++;
                    continue;
                }
            } else {
                $product = new WC_Product_Simple();
                $product->set_sku($variantSku);
                $product->set_status('publish');
            }

            $product->set_name($name);
            $product->set_slug(wc_prod_parent_slug($parentSku));
            $product->set_regular_price($price);
            $product->set_stock_status('instock');
            $product->set_catalog_visibility('visible');
            wc_prod_set_spec_attribute($product, $specTaxonomy, [$spec], false);

            $productId = $product->save();
            wc_prod_upsert_i18n_meta($productId, $name, $titleZh, $titleJa, $report, $variantSku);
            wc_prod_assign_categories($productId, $categorySlugs, $slugToId, $categoryTerms, $dryRun);

            if ($isUpdate) {
                $report['simpleUpdated']++;
            } else {
                $report['simpleCreated']++;
            }

            $idMap['parents'][$parentSku] = ['id' => (int) $productId, 'type' => 'simple', 'sku' => $variantSku];
            $idMap['variations'][$variantSku] = ['id' => (int) $productId, 'parentSku' => $parentSku];
            continue;
        }

        if ($type !== 'variable' || count($variations) < 2) {
            $report['errors'][] = "invalid variable entry for {$parentSku}";
            $report['skipped']++;
            continue;
        }

        $specValues = array_map(
            static fn($variation) => (string) ($variation['spec'] ?? 'Default'),
            $variations
        );

        $existingParentId = wc_get_product_id_by_sku($parentSku);
        $parentIsUpdate = $existingParentId > 0;

        if ($dryRun) {
            if ($parentIsUpdate) {
                $report['parentsUpdated']++;
            } else {
                $report['parentsCreated']++;
            }
            foreach ($variations as $variation) {
                $variantSku = trim((string) ($variation['sku'] ?? ''));
                if ($variantSku === '') {
                    continue;
                }
                $existingVarId = wc_get_product_id_by_sku($variantSku);
                if ($existingVarId > 0) {
                    $report['variationsUpdated']++;
                } else {
                    $report['variationsCreated']++;
                }
                $idMap['variations'][$variantSku] = [
                    'id' => $existingVarId ?: 0,
                    'parentSku' => $parentSku,
                ];
            }
            $idMap['parents'][$parentSku] = [
                'id' => $existingParentId ?: 0,
                'type' => 'variable',
                'sku' => $parentSku,
            ];
            continue;
        }

        if ($parentIsUpdate) {
            $parent = wc_get_product($existingParentId);
            if (!$parent || $parent->get_type() !== 'variable') {
                $report['errors'][] = "parent sku {$parentSku} exists as non-variable";
                $report['skipped']++;
                continue;
            }
        } else {
            $parent = new WC_Product_Variable();
            $parent->set_sku($parentSku);
            $parent->set_status('publish');
        }

        $parent->set_name($name);
        $parent->set_slug(wc_prod_parent_slug($parentSku));
        $parent->set_catalog_visibility('visible');
        $parent->set_stock_status('instock');
        wc_prod_set_spec_attribute($parent, $specTaxonomy, $specValues, true);

        $parentId = $parent->save();
        wc_prod_upsert_i18n_meta($parentId, $name, $titleZh, $titleJa, $report, $parentSku);
        wc_prod_assign_categories($parentId, $categorySlugs, $slugToId, $categoryTerms, $dryRun);

        if ($parentIsUpdate) {
            $report['parentsUpdated']++;
        } else {
            $report['parentsCreated']++;
        }

        $existingChildren = [];
        if ($parentIsUpdate) {
            foreach ($parent->get_children() as $childId) {
                $child = wc_get_product($childId);
                if ($child) {
                    $childSku = trim((string) $child->get_sku());
                    if ($childSku !== '') {
                        $existingChildren[$childSku] = (int) $childId;
                    }
                }
            }
        }

        $seenVariantSkus = [];
        foreach ($variations as $variation) {
            $variantSku = trim((string) ($variation['sku'] ?? ''));
            $spec = trim((string) ($variation['spec'] ?? 'Default'));
            $price = wc_prod_format_price((string) ($variation['price'] ?? ''), $defaultPrice);
            $variationZh = trim((string) ($variation['titleZh'] ?? ''));
            $variationJa = trim((string) ($variation['titleJa'] ?? ''));

            if ($variantSku === '') {
                continue;
            }
            $seenVariantSkus[] = $variantSku;

            $variationId = $existingChildren[$variantSku] ?? wc_get_product_id_by_sku($variantSku);
            $variationIsUpdate = $variationId > 0;

            if ($variationIsUpdate) {
                $variationProduct = wc_get_product($variationId);
                if (!$variationProduct || $variationProduct->get_type() !== 'variation') {
                    $report['errors'][] = "variation sku {$variantSku} exists as non-variation";
                    continue;
                }
            } else {
                $variationProduct = new WC_Product_Variation();
                $variationProduct->set_parent_id($parentId);
                $variationProduct->set_sku($variantSku);
                $variationProduct->set_status('publish');
            }

            $variationProduct->set_regular_price($price);
            $variationProduct->set_stock_status('instock');
            $variationProduct->set_attributes([$specTaxonomy => $spec]);

            $savedVariationId = $variationProduct->save();
            wc_prod_upsert_i18n_meta($savedVariationId, $name . ' - ' . $spec, $variationZh, $variationJa, $report, $variantSku);

            if ($variationIsUpdate) {
                $report['variationsUpdated']++;
            } else {
                $report['variationsCreated']++;
            }

            $idMap['variations'][$variantSku] = [
                'id' => (int) $savedVariationId,
                'parentSku' => $parentSku,
            ];
        }

        if ($parentIsUpdate && $existingChildren) {
            foreach ($existingChildren as $childSku => $childId) {
                if (!in_array($childSku, $seenVariantSkus, true)) {
                    wp_trash_post($childId);
                }
            }
        }

        $idMap['parents'][$parentSku] = [
            'id' => (int) $parentId,
            'type' => 'variable',
            'sku' => $parentSku,
        ];
    } catch (Throwable $e) {
        $report['errors'][] = "upsert {$parentSku}: " . $e->getMessage();
        $report['skipped']++;
    }
}

if (!$dryRun) {
    file_put_contents(
        $idMapPath,
        json_encode($idMap, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT)
    );
}

$report['catalogStats'] = $catalog['stats'] ?? null;
$report['idMapWritten'] = !$dryRun && is_file($idMapPath);
echo json_encode($report, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
