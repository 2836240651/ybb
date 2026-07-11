<?php
/**
 * Plugin Name: YBB Fix Admin Loader URLs
 * Description: Normalizes malformed wp-admin loader asset URLs injected by third-party plugins.
 * Version: 1.0.0
 */

if (!defined('ABSPATH')) {
    exit;
}

/**
 * Some plugin injects malformed admin asset URLs like:
 * /wp-admin/index.phpload-styles.php?...
 * which triggers Apache "script not found or unable to stat".
 * Normalize them to /wp-admin/load-styles.php and /wp-admin/load-scripts.php.
 */
function ybb_fix_admin_loader_src(string $src): string
{
    $src = str_replace('/wp-admin/index.phpload-styles.php', '/wp-admin/load-styles.php', $src);
    $src = str_replace('/wp-admin/index.phpload-scripts.php', '/wp-admin/load-scripts.php', $src);

    return $src;
}

add_filter('style_loader_src', static function ($src, $handle) {
    if (!is_string($src) || $src === '') {
        return $src;
    }

    if (is_admin() || strpos($src, '/wp-admin/index.phpload-') !== false || $handle === 'admin_styles_for_media') {
        return ybb_fix_admin_loader_src($src);
    }

    return $src;
}, 999, 2);

add_filter('script_loader_src', static function ($src) {
    if (!is_string($src) || $src === '') {
        return $src;
    }

    if (is_admin() || strpos($src, '/wp-admin/index.phpload-') !== false) {
        return ybb_fix_admin_loader_src($src);
    }

    return $src;
}, 999);

