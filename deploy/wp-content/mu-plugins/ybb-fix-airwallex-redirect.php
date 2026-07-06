<?php
/**
 * Plugin Name: YBB Fix Airwallex Redirect
 * Description: Headless static site serves /airwallex-checkout/ as homepage; force Airwallex hosted pay via wc-api route.
 * Version: 1.0.0
 */

if (!defined('ABSPATH')) {
    exit;
}

/**
 * Hosted payment page must hit WordPress (wc-api), not static export.
 */
function ybb_airwallex_wc_api_payment_url(int $order_id, bool $order_pay = false): string
{
    if (!function_exists('WC') || !WC()->api_request_url) {
        return home_url('/wc-api/airwallex_main?order_id=' . $order_id);
    }

    $url = WC()->api_request_url('airwallex_main');
    $url .= (strpos($url, '?') === false) ? '?' : '&';
    $url .= 'order_id=' . $order_id;

    if ($order_pay) {
        $url .= '&order_pay=1';
    }

    return $url;
}

/**
 * Replace broken /airwallex-checkout/ redirects after Place order.
 *
 * @param array<string, mixed> $result
 * @return array<string, mixed>
 */
function ybb_airwallex_fix_payment_result(array $result, int $order_id): array
{
    if (
        empty($result['result'])
        || $result['result'] !== 'success'
        || empty($result['redirect'])
        || !is_string($result['redirect'])
    ) {
        return $result;
    }

    $redirect = $result['redirect'];
    $broken = str_contains($redirect, '/airwallex-checkout')
        || rtrim($redirect, '/') === rtrim(home_url(), '/');

    if (!$broken) {
        return $result;
    }

    $parsed = wp_parse_url($redirect);
    $query = array();
    if (!empty($parsed['query'])) {
        parse_str($parsed['query'], $query);
    }

    $oid = isset($query['order_id']) ? (int) $query['order_id'] : $order_id;
    $order_pay = !empty($query['order_pay']) || !empty($_POST['woocommerce_pay']);

    $result['redirect'] = ybb_airwallex_wc_api_payment_url($oid, $order_pay);

    return $result;
}
add_filter('woocommerce_payment_successful_result', 'ybb_airwallex_fix_payment_result', 20, 2);

/**
 * If a bookmarked /airwallex-checkout/ link reaches WP, forward to wc-api.
 */
add_action('template_redirect', static function (): void {
    $uri = isset($_SERVER['REQUEST_URI']) ? (string) $_SERVER['REQUEST_URI'] : '';
    if (!preg_match('#^/airwallex-checkout(/|$)#i', $uri)) {
        return;
    }

    $order_id = isset($_GET['order_id']) ? (int) $_GET['order_id'] : 0;
    if ($order_id < 1) {
        return;
    }

    $order_pay = !empty($_GET['order_pay']);
    wp_safe_redirect(ybb_airwallex_wc_api_payment_url($order_id, $order_pay));
    exit;
}, 1);

/**
 * order-pay endpoint still renders the old fake checkout theme page �?send Airwallex orders to wc-api.
 */
add_action('template_redirect', static function (): void {
    if (!function_exists('is_wc_endpoint_url') || !is_wc_endpoint_url('order-pay')) {
        return;
    }

    global $wp;
    $order_id = isset($wp->query_vars['order-pay']) ? (int) $wp->query_vars['order-pay'] : 0;
    if ($order_id < 1) {
        return;
    }

    $order = wc_get_order($order_id);
    if (!$order instanceof WC_Order) {
        return;
    }

    $method = $order->get_payment_method();
    if (!in_array($method, array('airwallex_main', 'airwallex_card'), true)) {
        return;
    }

    if ($order->is_paid()) {
        wp_safe_redirect($order->get_checkout_order_received_url());
        exit;
    }

    wp_safe_redirect(ybb_airwallex_wc_api_payment_url($order_id, true));
    exit;
}, 4);

/**
 * Prefer wc-api template in Airwallex plugin (wordpress_page + /airwallex-checkout/ is broken on headless).
 */
add_action('init', static function (): void {
    if (get_option('airwallex_payment_page_template') === 'wordpress_page') {
        update_option('airwallex_payment_page_template', 'plugin');
    }
}, 20);

add_filter(
    'headless_mode_will_redirect',
    static function ($will_redirect, $new_url) {
        $uri = $_SERVER['REQUEST_URI'] ?? '';

        if (preg_match('#^/(airwallex-checkout|wc-api)(/|$)#i', $uri)) {
            return false;
        }

        return $will_redirect;
    },
    10,
    2
);
