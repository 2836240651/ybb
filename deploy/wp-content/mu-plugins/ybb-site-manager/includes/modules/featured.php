<?php

if (!defined('ABSPATH')) {
    exit;
}

function ybb_sm_featured_public(): array
{
    $data = ybb_sm_get_module('featured');
    $handle = sanitize_title((string) ($data['handle'] ?? ''));
    $out = [
        'enabled' => !empty($data['enabled']) && $handle !== '',
        'handle' => $handle,
        'syncedAt' => ybb_sm_synced_at(),
    ];

    if (!$out['enabled'] || !function_exists('ybb_home_wc_find_product_by_handle')) {
        return $out;
    }

    $wcProduct = ybb_home_wc_find_product_by_handle($handle);
    if (!$wcProduct instanceof WC_Product) {
        return $out;
    }

    $price = (float) $wcProduct->get_price();
    $regular = (float) $wcProduct->get_regular_price();
    $sale = (float) $wcProduct->get_sale_price();
    $compareAt = null;
    if ($sale > 0 && $regular > $sale) {
        $price = $sale;
        $compareAt = $regular;
    } elseif ($regular > 0) {
        $price = $regular;
    }

    $image = function_exists('ybb_home_product_image_url')
        ? ybb_home_product_image_url($handle, $wcProduct, '')
        : home_url('/products/' . $handle . '/master.webp');

    $out['product'] = [
        'handle' => $handle,
        'title' => $wcProduct->get_name(),
        'price' => $price,
        'compareAtPrice' => $compareAt,
        'image' => $image,
        'href' => home_url('/products/' . $handle),
        'available' => $wcProduct->is_in_stock(),
    ];

    return $out;
}
