<?php
/**
 * Plugin Name: YBB Headless Exemptions
 * Description: Allow Woo checkout/cart/account through Headless Mode redirects (carp-ybb.com).
 * Version: 1.0.1
 */

if (!defined('ABSPATH')) {
    exit;
}

add_filter(
    'headless_mode_will_redirect',
    static function ($will_redirect, $new_url) {
        $uri = $_SERVER['REQUEST_URI'] ?? '';

        if (preg_match('#^/(checkout|cart|my-account|my-account-2|airwallex-checkout|wc-api)(/|$)#i', $uri)) {
            return false;
        }

        if (isset($_GET['wc-ajax'])) {
            return false;
        }

        return $will_redirect;
    },
    10,
    2
);
