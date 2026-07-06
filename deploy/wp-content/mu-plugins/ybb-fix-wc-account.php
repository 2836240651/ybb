<?php
/**
 * Plugin Name: YBB Fix WC Account Routes
 * Description: Force WooCommerce My Account to /my-account/ (page 12); fix password-reset redirect to my-account-2 serving static homepage.
 * Version: 1.0.0
 */

if (!defined('ABSPATH')) {
    exit;
}

/** Canonical My Account page (slug my-account). */
const YBB_WC_MYACCOUNT_PAGE_ID = 12;

add_action('init', static function (): void {
    if (!function_exists('WC')) {
        return;
    }

    $current = (int) get_option('woocommerce_myaccount_page_id');
    if ($current !== YBB_WC_MYACCOUNT_PAGE_ID) {
        update_option('woocommerce_myaccount_page_id', YBB_WC_MYACCOUNT_PAGE_ID);
    }
}, 5);

/**
 * Rewrite any my-account-2 endpoint URLs to my-account (duplicate page 553).
 */
add_filter('woocommerce_get_endpoint_url', static function (
    string $url,
    string $endpoint,
    string $value,
    string $permalink
): string {
    if (str_contains($url, '/my-account-2')) {
        $url = str_replace('/my-account-2', '/my-account', $url);
    }

    return $url;
}, 20, 4);

add_action('template_redirect', static function (): void {
    $uri = isset($_SERVER['REQUEST_URI']) ? (string) $_SERVER['REQUEST_URI'] : '';
    if (!preg_match('#^/my-account-2(/|$)#i', $uri)) {
        return;
    }

    $target = preg_replace('#^/my-account-2#', '/my-account', $uri);
    if (!is_string($target) || $target === $uri) {
        return;
    }

    wp_safe_redirect(home_url($target), 301);
    exit;
}, 1);

add_filter(
    'headless_mode_will_redirect',
    static function ($will_redirect, $new_url) {
        $uri = $_SERVER['REQUEST_URI'] ?? '';

        if (preg_match('#^/my-account-2(/|$)#i', $uri)) {
            return false;
        }

        return $will_redirect;
    },
    10,
    2
);
