<?php

if (!defined('ABSPATH')) {
    exit;
}

const YBB_SM_PRODUCT_CATALOG_TTL = 900;
const YBB_SM_PRODUCT_CATALOG_EMPTY_TTL = 45;

function ybb_sm_product_catalog_cache_token(): string
{
    $meta = ybb_sm_product_index_meta();
    $deploy = function_exists('ybb_sm_deploy_get') ? ybb_sm_deploy_get() : [];
    $handleCount = function_exists('ybb_sm_product_static_handles')
        ? count(ybb_sm_product_static_handles())
        : 0;

    return sha1(
        (string) ($meta['lastBuildId'] ?? '') . '|' .
        (string) ($meta['lastBuiltAt'] ?? '') . '|' .
        (string) ($meta['productCount'] ?? '') . '|' .
        (string) $handleCount . '|' .
        (string) ($deploy['state'] ?? '') . '|' .
        (string) ($deploy['finishedAt'] ?? '')
    );
}

function ybb_sm_product_catalog_flush_cache(): void
{
    global $wpdb;
    if (!isset($wpdb)) {
        return;
    }
    $wpdb->query(
        "DELETE FROM {$wpdb->options} WHERE option_name LIKE '_transient_ybb_sm_product_catalog_%' " .
        "OR option_name LIKE '_transient_timeout_ybb_sm_product_catalog_%'"
    );
}

function ybb_sm_product_catalog_search_kind(string $search): string
{
    $search = trim($search);
    if ($search === '') {
        return '';
    }
    if (preg_match('/^TZ[-_]/i', $search)) {
        return 'sku';
    }
    if (preg_match('/^[a-z0-9]+(?:-[a-z0-9]+)*$/', strtolower($search))) {
        return 'handle';
    }

    return 'text';
}

function ybb_sm_product_catalog_query_args(int $page, int $perPage, string $search = ''): array
{
    $page = max(1, $page);
    $perPage = max(1, min(50, $perPage));
    $args = [
        'status' => ['publish', 'draft', 'private'],
        'type' => ['simple', 'variable', 'grouped', 'external'],
        'parent' => 0,
        'limit' => $perPage,
        'page' => $page,
        'orderby' => 'title',
        'order' => 'ASC',
        'return' => 'objects',
        'paginate' => true,
    ];

    $search = trim($search);
    if ($search === '') {
        return $args;
    }

    $kind = ybb_sm_product_catalog_search_kind($search);
    if ($kind === 'sku') {
        $args['sku'] = strtoupper($search);
        unset($args['paginate']);
        $args['limit'] = $perPage;
    } elseif ($kind === 'handle') {
        $args['slug'] = sanitize_title($search);
        unset($args['paginate']);
        $args['limit'] = $perPage;
    } else {
        $args['s'] = $search;
    }

    return $args;
}

/** @return array{products:array<int,WC_Product>,total:int,source:string} */
function ybb_sm_product_catalog_fetch(int $page, int $perPage, string $search = ''): array
{
    $products = [];
    $total = 0;
    $source = 'none';

    if (function_exists('wc_get_products')) {
        $args = ybb_sm_product_catalog_query_args($page, $perPage, $search);
        $result = wc_get_products($args);
        if (is_array($result) && isset($result['products'])) {
            $products = is_array($result['products']) ? $result['products'] : [];
            $total = (int) ($result['total'] ?? count($products));
            $source = 'wc_get_products';
        } elseif (is_array($result)) {
            $products = $result;
            $total = count($products);
            $source = 'wc_get_products_list';
        }
    }

    if ($products === [] && class_exists('WP_Query')) {
        $queryArgs = [
            'post_type' => 'product',
            'post_status' => ['publish', 'draft', 'private'],
            'posts_per_page' => $perPage,
            'paged' => $page,
            'orderby' => 'title',
            'order' => 'ASC',
            'post_parent' => 0,
            'fields' => 'ids',
            'no_found_rows' => false,
        ];
        $search = trim($search);
        if ($search !== '') {
            $kind = ybb_sm_product_catalog_search_kind($search);
            if ($kind === 'sku') {
                $queryArgs['meta_query'] = [[
                    'key' => '_sku',
                    'value' => strtoupper($search),
                    'compare' => 'LIKE',
                ]];
            } elseif ($kind === 'handle') {
                $queryArgs['name'] = sanitize_title($search);
            } else {
                $queryArgs['s'] = $search;
            }
        }
        $query = new WP_Query($queryArgs);
        $ids = is_array($query->posts) ? $query->posts : [];
        $total = (int) $query->found_posts;
        $products = [];
        foreach ($ids as $id) {
            if (!function_exists('wc_get_product')) {
                continue;
            }
            $product = wc_get_product((int) $id);
            if ($product instanceof WC_Product && !$product->is_type('variation')) {
                $products[] = $product;
            }
        }
        $source = 'wp_query';
    }

    return [
        'products' => $products,
        'total' => $total,
        'source' => $source,
    ];
}

/** @return array{page:int,perPage:int,total:int,items:array<int,array<string,mixed>>,debug?:array<string,mixed>} */
function ybb_sm_product_catalog_list(int $page = 1, int $perPage = 20, string $search = '', bool $forceRefresh = false): array
{
    if (!function_exists('wc_get_products') && !class_exists('WP_Query')) {
        return [
            'page' => $page,
            'perPage' => $perPage,
            'total' => 0,
            'items' => [],
            'debug' => ['reason' => 'woocommerce_inactive'],
        ];
    }

    $deployState = function_exists('ybb_sm_deploy_get') ? (string) (ybb_sm_deploy_get()['state'] ?? '') : '';
    if ($forceRefresh || $deployState === 'running') {
        $forceRefresh = true;
    }

    $cacheKey = 'ybb_sm_product_catalog_' . md5(
        $page . '|' . $perPage . '|' . strtolower($search) . '|' . ybb_sm_product_catalog_cache_token()
    );
    if (!$forceRefresh) {
        $cached = get_transient($cacheKey);
        if (is_array($cached) && !empty($cached['items'])) {
            return $cached;
        }
    }

    $fetch = ybb_sm_product_catalog_fetch($page, $perPage, $search);
    $products = $fetch['products'];
    $total = (int) $fetch['total'];

    $indexMeta = ybb_sm_product_index_meta();
    $staticHandleSet = function_exists('ybb_sm_product_static_handle_set')
        ? ybb_sm_product_static_handle_set()
        : [];
    $staticKnown = $staticHandleSet !== [];
    $items = [];

    foreach ($products as $product) {
        if (!$product instanceof WC_Product) {
            continue;
        }
        if ($product->is_type('variation')) {
            continue;
        }

        $sku = (string) $product->get_sku();
        $handle = $sku !== '' ? ybb_sm_product_handle_from_sku($sku) : sanitize_title($product->get_slug());
        $override = ybb_sm_product_override_get($handle);
        $override = ybb_sm_product_override_normalize($override);
        $wooGalleryImages = ybb_sm_product_images_from_wc($product);
        $prices = ybb_sm_product_price_from_wc($product);
        $variantCount = $product->is_type('variable') ? count($product->get_children()) : 1;

        $items[] = [
            'handle' => $handle,
            'parentSku' => $sku !== '' ? $sku : strtoupper($handle),
            'wcId' => (int) $product->get_id(),
            'wooStatus' => (string) $product->get_status(),
            'wooName' => (string) $product->get_name(),
            'price' => $prices['price'],
            'inStock' => $product->is_in_stock(),
            'variantCount' => $variantCount,
            'staticSyncedAt' => (string) ($indexMeta['lastBuiltAt'] ?? ''),
            'staticExported' => $staticKnown && isset($staticHandleSet[$handle]),
            'staticPending' => $staticKnown
                && $product->get_status() === 'publish'
                && !isset($staticHandleSet[$handle]),
            'hasOverride' => $override['titleZh'] !== '' || $override['titleJa'] !== '' || $override['frontHidden']
                || $override['descriptionZh'] !== '' || $override['descriptionJa'] !== ''
                || $override['hideDescription'] || $override['hideAdditionalInfo']
                || !$override['galleryEnabled']
                || !empty($override['galleryOverrideEnabled'])
                || (int) ($override['galleryDefaultIndex'] ?? 0) > 0
                || ($override['galleryImages'] ?? []) !== []
                || ($override['galleryHideIndexes'] ?? []) !== [],
            'frontHidden' => $override['frontHidden'],
            'titleZh' => $override['titleZh'],
            'titleJa' => $override['titleJa'],
            'descriptionZh' => $override['descriptionZh'],
            'descriptionJa' => $override['descriptionJa'],
            'hideDescription' => $override['hideDescription'],
            'hideAdditionalInfo' => $override['hideAdditionalInfo'],
            'galleryEnabled' => $override['galleryEnabled'],
            'galleryOverrideEnabled' => !empty($override['galleryOverrideEnabled']),
            'galleryDefaultIndex' => (int) ($override['galleryDefaultIndex'] ?? 0),
            'galleryImages' => is_array($override['galleryImages'] ?? null) ? $override['galleryImages'] : [],
            'galleryHideIndexes' => is_array($override['galleryHideIndexes'] ?? null) ? $override['galleryHideIndexes'] : [],
            'wooGalleryImages' => $wooGalleryImages,
            'gallerySource' => !empty($override['galleryOverrideEnabled']) && ($override['galleryImages'] ?? []) !== []
                ? 'override'
                : 'woo',
            'sloganEn' => $override['sloganEn'],
            'sloganZh' => $override['sloganZh'],
            'sloganJa' => $override['sloganJa'],
            'hideSlogan' => $override['hideSlogan'],
            'editUrl' => admin_url('post.php?post=' . $product->get_id() . '&action=edit'),
            'pdpUrl' => home_url('/products/' . $handle . '.html'),
        ];
    }

    $payload = [
        'page' => $page,
        'perPage' => $perPage,
        'total' => $total,
        'items' => $items,
        'syncedAt' => ybb_sm_synced_at(),
    ];

    if ($items === []) {
        $payload['debug'] = [
            'reason' => 'empty_result',
            'source' => $fetch['source'],
            'deployState' => $deployState,
            'forceRefresh' => $forceRefresh,
            'search' => $search,
        ];
        set_transient($cacheKey, $payload, YBB_SM_PRODUCT_CATALOG_EMPTY_TTL);
    } else {
        set_transient($cacheKey, $payload, YBB_SM_PRODUCT_CATALOG_TTL);
    }

    return $payload;
}

function ybb_sm_product_catalog_public(WP_REST_Request $request): array
{
    return ybb_sm_product_catalog_list(
        (int) ($request->get_param('page') ?? 1),
        (int) ($request->get_param('per_page') ?? 20),
        (string) ($request->get_param('search') ?? ''),
        (bool) $request->get_param('refresh')
    );
}
