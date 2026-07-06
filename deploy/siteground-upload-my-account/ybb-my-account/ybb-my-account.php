<?php
/**
 * YBB My Account mu-plugin bootstrap.
 *
 * @package YBB_My_Account
 */

if (!defined('ABSPATH')) {
    exit;
}

define('YBB_MY_ACCOUNT_VERSION', '1.0.0');
define('YBB_MY_ACCOUNT_DIR', __DIR__);
define('YBB_MY_ACCOUNT_URL', content_url('mu-plugins/ybb-my-account/'));

/**
 * @return bool
 */
function ybb_my_account_is_active_page(): bool
{
    return function_exists('is_account_page') && is_account_page();
}

add_filter('template_include', static function (string $template): string {
    if (!ybb_my_account_is_active_page()) {
        return $template;
    }

    $custom = YBB_MY_ACCOUNT_DIR . '/templates/page-my-account.php';
    if (is_readable($custom)) {
        return $custom;
    }

    return $template;
}, 99);

add_filter('body_class', static function (array $classes): array {
    if (ybb_my_account_is_active_page()) {
        $classes[] = 'ybb-account-page';
        $classes[] = 'woocommerce-account';
    }

    return $classes;
});

add_action('wp_enqueue_scripts', static function (): void {
    if (!ybb_my_account_is_active_page()) {
        return;
    }

    wp_enqueue_style(
        'ybb-my-account-flat',
        YBB_MY_ACCOUNT_URL . 'assets/my-account-flat.css',
        array(),
        YBB_MY_ACCOUNT_VERSION
    );
}, 20);

add_filter('ybb_my_account_next_base_url', static function (string $url): string {
    $configured = apply_filters('ybb_flat_checkout_next_base_url', 'https://carp-ybb.com');
    return untrailingslashit($configured);
});

/**
 * Primary nav links (subset of Next navigation.json for WP shell).
 *
 * @return list<array{label: string, url: string}>
 */
function ybb_my_account_nav_links(): array
{
    $base = apply_filters('ybb_my_account_next_base_url', home_url('/'));
    $t = ybb_my_account_strings();

    $items = array(
        array('label' => $t['nav_new'], 'url' => $base . '/collections/2026-new-products/'),
        array('label' => $t['nav_sinkers'], 'url' => $base . '/collections/sinkers/'),
        array('label' => $t['nav_bait_cages'], 'url' => $base . '/collections/bait-cages/'),
        array('label' => $t['nav_rigs'], 'url' => $base . '/collections/rigs/'),
        array('label' => $t['nav_oem'], 'url' => $base . '/pages/oem-odm/'),
        array('label' => $t['nav_contact'], 'url' => $base . '/contact/'),
    );

    return apply_filters('ybb_my_account_nav_links', $items);
}

/**
 * @return array<string, string>
 */
function ybb_my_account_strings(): array
{
    $lang = function_exists('determine_locale') ? substr(determine_locale(), 0, 2) : 'en';
    if (!in_array($lang, array('en', 'zh'), true)) {
        $lang = 'en';
    }

    $copy = array(
        'en' => array(
            'home' => 'Home',
            'account' => 'My Account',
            'crumb' => 'Home / My Account',
            'nav_new' => '2026 New Products',
            'nav_sinkers' => 'Sinkers',
            'nav_bait_cages' => 'Bait Cages',
            'nav_rigs' => 'Rigs',
            'nav_oem' => 'OEM / ODM',
            'nav_contact' => 'Contact',
            'cart' => 'Cart',
        ),
        'zh' => array(
            'home' => '首页',
            'account' => '我的帐户',
            'crumb' => '首页 / 我的帐户',
            'nav_new' => '2026 新品',
            'nav_sinkers' => '铅坠',
            'nav_bait_cages' => '饵笼',
            'nav_rigs' => '钓组',
            'nav_oem' => 'OEM / ODM',
            'nav_contact' => '联系我们',
            'cart' => '购物车',
        ),
    );

    return $copy[$lang] ?? $copy['en'];
}
