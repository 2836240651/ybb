<?php
/**
 * YBB flat checkout mu-plugin bootstrap.
 *
 * @package YBB_Flat_Checkout
 */

if (!defined('ABSPATH')) {
    exit;
}

define('YBB_FLAT_CHECKOUT_VERSION', '1.0.3');
define('YBB_FLAT_CHECKOUT_DIR', __DIR__);
define('YBB_FLAT_CHECKOUT_URL', content_url('mu-plugins/ybb-flat-checkout/'));

/**
 * @return bool
 */
function ybb_flat_checkout_is_active_page(): bool
{
    return function_exists('is_checkout')
        && is_checkout()
        && !is_wc_endpoint_url('order-received')
        && !is_wc_endpoint_url('order-pay');
}

add_filter('template_include', static function (string $template): string {
    if (!ybb_flat_checkout_is_active_page()) {
        return $template;
    }

    $custom = YBB_FLAT_CHECKOUT_DIR . '/templates/page-checkout.php';
    if (is_readable($custom)) {
        return $custom;
    }

    return $template;
}, 99);

add_action('template_redirect', static function (): void {
    if (!ybb_flat_checkout_is_active_page()) {
        return;
    }

    if (!function_exists('WC') || !WC()->cart || WC()->cart->is_empty()) {
        wp_safe_redirect(wc_get_cart_url());
        exit;
    }
}, 5);

add_action('template_redirect', static function (): void {
    if (!ybb_flat_checkout_is_active_page() || is_user_logged_in()) {
        return;
    }

    $checkout = WC()->checkout();
    if (!$checkout->is_registration_required()) {
        return;
    }

    $myaccount = wc_get_page_permalink('myaccount');
    if (!$myaccount) {
        return;
    }

    wp_safe_redirect(
        add_query_arg(
            'redirect_to',
            rawurlencode(wc_get_checkout_url()),
            $myaccount
        )
    );
    exit;
}, 6);

add_filter('body_class', static function (array $classes): array {
    if (ybb_flat_checkout_is_active_page()) {
        $classes[] = 'ybb-checkout-page';
        $classes[] = 'woocommerce-checkout';
    }

    return $classes;
});

add_action('wp_enqueue_scripts', static function (): void {
    if (!ybb_flat_checkout_is_active_page()) {
        return;
    }

    wp_enqueue_style(
        'ybb-checkout-flat',
        YBB_FLAT_CHECKOUT_URL . 'assets/checkout-flat.css',
        array(),
        YBB_FLAT_CHECKOUT_VERSION
    );

    if (function_exists('ybb_enqueue_locale_sync_script')) {
        ybb_enqueue_locale_sync_script();
    }
}, 20);

add_filter('woocommerce_locate_template', static function (
    string $template,
    string $template_name,
    string $template_path
): string {
    if (!ybb_flat_checkout_is_active_page()) {
        return $template;
    }

    $plugin_template = YBB_FLAT_CHECKOUT_DIR . '/woocommerce/' . $template_name;
    if (is_readable($plugin_template)) {
        return $plugin_template;
    }

    return $template;
}, 20, 3);

add_filter('ybb_checkout_next_base_url', static function (string $url): string {
    $configured = apply_filters('ybb_flat_checkout_next_base_url', 'https://carp-ybb.com');
    return untrailingslashit($configured);
});

/**
 * Prefer an Airwallex gateway when available (hosted main > embedded card).
 */
function ybb_flat_checkout_preferred_airwallex_id(array $gateways): ?string
{
    foreach (array('airwallex_main', 'airwallex_card') as $id) {
        if (isset($gateways[$id])) {
            return $id;
        }
    }

    return null;
}

add_filter('woocommerce_available_payment_gateways', static function (array $gateways): array {
    if (!ybb_flat_checkout_is_active_page()) {
        return $gateways;
    }

    $preferred = ybb_flat_checkout_preferred_airwallex_id($gateways);
    if ($preferred === null) {
        return $gateways;
    }

    $gateway = $gateways[$preferred];
    unset($gateways[$preferred]);

    return array_merge(array($preferred => $gateway), $gateways);
});

add_action('woocommerce_before_checkout_form', static function (): void {
    if (!ybb_flat_checkout_is_active_page() || !WC()->session) {
        return;
    }

    $available = WC()->payment_gateways()->get_available_payment_gateways();
    $preferred = ybb_flat_checkout_preferred_airwallex_id($available);
    if ($preferred !== null) {
        WC()->session->set('chosen_payment_method', $preferred);
    }
}, 5);

/**
 * @return array<string, string>
 */
function ybb_flat_checkout_strings(): array
{
    $lang = function_exists('ybb_get_active_locale')
        ? ybb_get_active_locale()
        : (function_exists('determine_locale') ? substr(determine_locale(), 0, 2) : 'en');
    if (!in_array($lang, array('en', 'zh', 'ja'), true)) {
        $lang = 'en';
    }

    $copy = array(
        'en' => array(
            'home' => 'Home',
            'shop' => 'Shop',
            'oem' => 'OEM / ODM',
            'contact' => 'Contact',
            'checkout' => 'Checkout',
            'step' => 'Step 2 of 3',
            'crumb' => 'Home / Cart / Checkout',
            'back_to_cart' => '�?Back to cart',
            'safe' => 'Secure checkout | SSL encrypted | Airwallex hosted payment.',
        ),
        'zh' => array(
            'home' => '首页',
            'shop' => '商城',
            'oem' => 'OEM / ODM',
            'contact' => '联系我们',
            'checkout' => '结账',
            'step' => '�?2 / 3 �?,
            'crumb' => '首页 / 购物�?/ 结账',
            'back_to_cart' => '�?返回购物�?,
            'safe' => '安全结账 | SSL 加密 | 空中云汇托管支付�?,
        ),
        'ja' => array(
            'home' => 'ホー�?,
            'shop' => 'ショップ',
            'oem' => 'OEM / ODM',
            'contact' => 'お問い合わせ',
            'checkout' => 'チェックアウ�?,
            'step' => 'ステップ 2 / 3',
            'crumb' => 'ホー�?/ カー�?/ チェックアウ�?,
            'back_to_cart' => '�?カートに戻る',
            'safe' => '安全なチェックアウト | SSL 暗号�?| Airwallex ホスト決済�?,
        ),
    );

    return $copy[$lang] ?? $copy['en'];
}
