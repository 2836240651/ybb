<?php
/**
 * YBB product review form embed for static Next.js iframe.
 * GET ?product_id={woocommerce_product_id}
 *
 * Served as a real PHP file (bypasses Next static fallback; no htaccess rewrite needed).
 */
declare(strict_types=1);

define('WP_USE_THEMES', false);

$wpLoad = __DIR__ . '/wp-load.php';
if (!is_file($wpLoad)) {
    http_response_code(503);
    header('Content-Type: text/plain; charset=UTF-8');
    echo 'WordPress not found';
    exit;
}

require $wpLoad;

$product_id = isset($_GET['product_id']) ? (int) $_GET['product_id'] : 0;
if ($product_id <= 0) {
    http_response_code(400);
    header('Content-Type: text/plain; charset=UTF-8');
    echo 'Invalid product_id';
    exit;
}

if (!function_exists('ybb_product_reviews_render_embed_html')) {
    http_response_code(503);
    header('Content-Type: text/plain; charset=UTF-8');
    echo 'YBB Product Reviews plugin not loaded';
    exit;
}

$html = ybb_product_reviews_render_embed_html($product_id);
if (is_wp_error($html)) {
    $status = (int) ($html->get_error_data()['status'] ?? 500);
    status_header($status);
    nocache_headers();
    header('Content-Type: text/plain; charset=UTF-8');
    echo esc_html($html->get_error_message());
    exit;
}

status_header(200);
nocache_headers();
header('Content-Type: text/html; charset=UTF-8');
header('X-Robots-Tag: noindex');
header('X-Frame-Options: SAMEORIGIN');
echo $html;
exit;
