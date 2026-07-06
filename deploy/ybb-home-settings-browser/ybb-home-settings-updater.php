<?php
/**
 * Plugin Name: YBB Home Settings Updater
 * Description: One-click copy Latest Stories admin MU plugin into mu-plugins.
 * Version: 1.1.0
 */
if (!defined('ABSPATH')) { exit; }
register_activation_hook(__FILE__, function () {
    $src = __DIR__ . '/ybb-home-settings.php';
    $dst = WPMU_PLUGIN_DIR . '/ybb-home-settings.php';
    if (!is_readable($src)) {
        wp_die('Missing ybb-home-settings.php in plugin package.');
    }
    if (!copy($src, $dst)) {
        wp_die('Failed to copy MU plugin to ' . esc_html($dst));
    }
});
