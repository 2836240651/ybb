<?php
/**
 * Plugin Name: YBB WP Admin Login Fix
 * Description: After wp-login, redirect to wp-admin/index.php (SiteGround blocks bare /wp-admin/).
 * Version: 1.0.1
 */

if (!defined('ABSPATH')) {
    exit;
}

/**
 * WordPress default login redirect targets /wp-admin/ which SiteGround may 403 or SG-Captcha.
 */
add_filter('login_redirect', static function ($redirect_to, $requested_redirect_to, $user) {
    if (is_wp_error($user) || !($user instanceof WP_User)) {
        return $redirect_to;
    }

    $target = is_string($requested_redirect_to) && $requested_redirect_to !== ''
        ? $requested_redirect_to
        : (string) $redirect_to;

    if ($target !== '' && preg_match('#/wp-admin/?$#', $target)) {
        return admin_url('index.php');
    }

    return $redirect_to;
}, 10, 3);
