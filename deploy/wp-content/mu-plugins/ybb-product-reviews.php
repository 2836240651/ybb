<?php
/**
 * Plugin Name: YBB Product Reviews
 * Description: Public REST for Woo product reviews + embeddable review form for static PDP.
 * Version: 1.2.0
 */

if (!defined('ABSPATH')) {
    exit;
}

/** Auto-approve product reviews so they appear on the static site immediately. */
function ybb_product_reviews_auto_approve(int|string $approved, array $commentdata): int|string
{
    $post_id = (int) ($commentdata['comment_post_ID'] ?? 0);
    if ($post_id <= 0 || get_post_type($post_id) !== 'product') {
        return $approved;
    }

    return 1;
}
add_filter('pre_comment_approved', 'ybb_product_reviews_auto_approve', 20, 2);

function ybb_product_reviews_clear_product_transients(int $comment_id): void
{
    $comment = get_comment($comment_id);
    if (!$comment) {
        return;
    }

    $post_id = (int) $comment->comment_post_ID;
    if ($post_id <= 0 || get_post_type($post_id) !== 'product') {
        return;
    }

    if (function_exists('wc_delete_product_transients')) {
        wc_delete_product_transients($post_id);
    }
}
add_action('comment_post', 'ybb_product_reviews_clear_product_transients', 20);
add_action('wp_set_comment_status', 'ybb_product_reviews_clear_product_transients', 20);

/** One-time: approve reviews that were stuck in moderation before auto-approve shipped. */
function ybb_product_reviews_approve_existing_pending(): void
{
    if (get_option('ybb_product_reviews_approved_pending_v1')) {
        return;
    }

    $pending = get_comments([
        'status' => 'hold',
        'type' => 'review',
        'number' => 200,
    ]);

    foreach ($pending as $comment) {
        wp_set_comment_status((int) $comment->comment_ID, 'approve');
        ybb_product_reviews_clear_product_transients((int) $comment->comment_ID);
    }

    update_option('ybb_product_reviews_approved_pending_v1', gmdate('c'), false);
}
add_action('init', 'ybb_product_reviews_approve_existing_pending', 20);

/** Max review photos per comment. */
function ybb_product_reviews_max_images(): int
{
    return 3;
}

/** Max bytes per review photo (2 MB). */
function ybb_product_reviews_max_image_bytes(): int
{
    return 2 * 1024 * 1024;
}

/** Allowed review photo MIME types. */
function ybb_product_reviews_allowed_mimes(): array
{
    return [
        'jpg|jpeg|jpe' => 'image/jpeg',
        'png' => 'image/png',
        'webp' => 'image/webp',
    ];
}

function ybb_product_reviews_format_image(int $attachment_id): ?array
{
    if ($attachment_id <= 0) {
        return null;
    }

    $url = wp_get_attachment_url($attachment_id);
    if (!$url) {
        return null;
    }

    $meta = wp_get_attachment_metadata($attachment_id);
    $thumb = wp_get_attachment_image_url($attachment_id, 'thumbnail') ?: $url;

    return [
        'id' => $attachment_id,
        'url' => (string) $url,
        'thumb' => (string) $thumb,
        'width' => (int) ($meta['width'] ?? 0),
        'height' => (int) ($meta['height'] ?? 0),
    ];
}

function ybb_product_reviews_get_comment_images(int $comment_id): array
{
    $stored = get_comment_meta($comment_id, 'ybb_review_images', true);
    if (!is_array($stored)) {
        return [];
    }

    $images = [];
    foreach ($stored as $attachment_id) {
        $formatted = ybb_product_reviews_format_image((int) $attachment_id);
        if ($formatted) {
            $images[] = $formatted;
        }
    }

    return $images;
}

function ybb_product_reviews_validate_image_file(array $file): true|WP_Error
{
    if (($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
        return new WP_Error('upload_error', 'Image upload failed.');
    }

    if ((int) ($file['size'] ?? 0) > ybb_product_reviews_max_image_bytes()) {
        return new WP_Error('file_too_large', 'Each photo must be 2 MB or smaller.');
    }

    $check = wp_check_filetype_and_ext(
        (string) ($file['tmp_name'] ?? ''),
        (string) ($file['name'] ?? ''),
        ybb_product_reviews_allowed_mimes()
    );
    if (empty($check['ext']) || empty($check['type'])) {
        return new WP_Error('invalid_type', 'Only JPG, PNG and WebP photos are allowed.');
    }

    $image_info = @getimagesize((string) $file['tmp_name']);
    if ($image_info === false) {
        return new WP_Error('invalid_image', 'Uploaded file is not a valid image.');
    }

    return true;
}

function ybb_product_reviews_upload_image_file(array $file, int $product_id, string $comment_status): int|WP_Error
{
    $valid = ybb_product_reviews_validate_image_file($file);
    if (is_wp_error($valid)) {
        return $valid;
    }

    require_once ABSPATH . 'wp-admin/includes/file.php';
    require_once ABSPATH . 'wp-admin/includes/media.php';
    require_once ABSPATH . 'wp-admin/includes/image.php';

    $upload = wp_handle_upload($file, ['test_form' => false]);
    if (!empty($upload['error'])) {
        return new WP_Error('upload_error', (string) $upload['error']);
    }

    $attachment_status = $comment_status === '1' ? 'inherit' : 'pending';
    $attachment_id = wp_insert_attachment([
        'post_mime_type' => (string) $upload['type'],
        'post_title' => sanitize_file_name(pathinfo((string) $file['name'], PATHINFO_FILENAME)),
        'post_content' => '',
        'post_status' => $attachment_status,
        'post_parent' => $product_id,
    ], (string) $upload['file']);

    if (is_wp_error($attachment_id)) {
        @unlink((string) $upload['file']);
        return $attachment_id;
    }

    $attach_data = wp_generate_attachment_metadata($attachment_id, (string) $upload['file']);
    wp_update_attachment_metadata($attachment_id, $attach_data);

    return (int) $attachment_id;
}

function ybb_product_reviews_save_comment_images(int $comment_id, int|string $comment_approved): void
{
    $comment = get_comment($comment_id);
    if (!$comment || $comment->comment_type !== 'review') {
        return;
    }

    $product_id = (int) $comment->comment_post_ID;
    if ($product_id <= 0 || get_post_type($product_id) !== 'product') {
        return;
    }

    if (empty($_FILES['ybb_review_images']) || !is_array($_FILES['ybb_review_images']['name'] ?? null)) {
        return;
    }

    $files = $_FILES['ybb_review_images'];
    $names = $files['name'];
    if (!is_array($names)) {
        $names = [$names];
        foreach (['type', 'tmp_name', 'error', 'size'] as $key) {
            $files[$key] = [$files[$key]];
        }
    }

    $attachment_ids = [];
    $max = ybb_product_reviews_max_images();

    foreach ($names as $index => $name) {
        if (count($attachment_ids) >= $max) {
            break;
        }
        if (!is_string($name) || $name === '') {
            continue;
        }

        $file = [
            'name' => (string) ($files['name'][$index] ?? ''),
            'type' => (string) ($files['type'][$index] ?? ''),
            'tmp_name' => (string) ($files['tmp_name'][$index] ?? ''),
            'error' => (int) ($files['error'][$index] ?? UPLOAD_ERR_NO_FILE),
            'size' => (int) ($files['size'][$index] ?? 0),
        ];

        $uploaded = ybb_product_reviews_upload_image_file($file, $product_id, (string) $comment_approved);
        if (!is_wp_error($uploaded)) {
            $attachment_ids[] = $uploaded;
        }
    }

    if ($attachment_ids !== []) {
        update_comment_meta($comment_id, 'ybb_review_images', $attachment_ids);
    }
}
add_action('comment_post', 'ybb_product_reviews_save_comment_images', 10, 2);

function ybb_product_reviews_sync_attachment_status(int $comment_id): void
{
    $comment = get_comment($comment_id);
    if (!$comment || $comment->comment_type !== 'review') {
        return;
    }

    $stored = get_comment_meta($comment_id, 'ybb_review_images', true);
    if (!is_array($stored)) {
        return;
    }

    $status = $comment->comment_approved === '1' ? 'inherit' : 'pending';
    foreach ($stored as $attachment_id) {
        wp_update_post([
            'ID' => (int) $attachment_id,
            'post_status' => $status,
        ]);
    }
}
add_action('comment_post', 'ybb_product_reviews_sync_attachment_status', 30);
add_action('wp_set_comment_status', 'ybb_product_reviews_sync_attachment_status', 20);

function ybb_product_reviews_delete_comment_images(int $comment_id): void
{
    $stored = get_comment_meta($comment_id, 'ybb_review_images', true);
    if (!is_array($stored)) {
        return;
    }

    foreach ($stored as $attachment_id) {
        wp_delete_attachment((int) $attachment_id, true);
    }

    delete_comment_meta($comment_id, 'ybb_review_images');
}
add_action('delete_comment', 'ybb_product_reviews_delete_comment_images', 10);

function ybb_product_reviews_get_payload(int $product_id, ?int $limit = null): array|WP_Error
{
    if (!function_exists('wc_get_product')) {
        return new WP_Error('woocommerce_missing', 'WooCommerce is not active.', ['status' => 503]);
    }

    $product = wc_get_product($product_id);
    if (!$product) {
        return new WP_Error('not_found', 'Product not found.', ['status' => 404]);
    }

    $comment_args = [
        'post_id' => $product_id,
        'status' => 'approve',
        'type' => 'review',
        'orderby' => 'comment_date_gmt',
        'order' => 'DESC',
    ];
    if ($limit !== null && $limit > 0) {
        $comment_args['number'] = $limit;
    }

    $comments = get_comments($comment_args);

    $reviews = [];
    foreach ($comments as $comment) {
        $reviews[] = [
            'id' => (int) $comment->comment_ID,
            'author' => (string) $comment->comment_author,
            'rating' => (int) get_comment_meta($comment->comment_ID, 'rating', true),
            'content' => wp_strip_all_tags((string) $comment->comment_content),
            'date' => mysql2date('c', $comment->comment_date_gmt, false),
            'images' => ybb_product_reviews_get_comment_images((int) $comment->comment_ID),
        ];
    }

    $payload = [
        'product_id' => $product_id,
        'review_count' => (int) $product->get_review_count(),
        'average_rating' => (float) $product->get_average_rating(),
        'reviews' => $reviews,
        'syncedAt' => gmdate('c'),
    ];
    if ($limit !== null && $limit > 0) {
        $payload['limit'] = $limit;
    }

    return $payload;
}

function ybb_product_reviews_rest_handler(WP_REST_Request $request): array|WP_Error
{
    $product_id = (int) $request['product_id'];
    if ($product_id <= 0) {
        return new WP_Error('invalid_id', 'Invalid product id.', ['status' => 400]);
    }

    $limit = $request->get_param('limit');
    $limit_int = null;
    if ($limit !== null && $limit !== '') {
        $limit_int = max(1, min(50, (int) $limit));
    }

    return ybb_product_reviews_get_payload($product_id, $limit_int);
}

function ybb_product_reviews_rest_nocache_headers($response, WP_REST_Server $server, WP_REST_Request $request): WP_REST_Response
{
    $route = $request->get_route();
    if (!str_starts_with($route, '/ybb/v1/product-reviews/') || str_contains($route, 'embed')) {
        return $response;
    }

    $response->header('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');
    $response->header('Pragma', 'no-cache');
    $response->header('Expires', '0');

    return $response;
}
add_filter('rest_post_dispatch', 'ybb_product_reviews_rest_nocache_headers', 5, 3);

function ybb_product_reviews_register_rest(): void
{
    register_rest_route('ybb/v1', '/product-reviews/(?P<product_id>\d+)', [
        'methods' => 'GET',
        'permission_callback' => '__return_true',
        'callback' => 'ybb_product_reviews_rest_handler',
        'args' => [
            'product_id' => [
                'required' => true,
                'type' => 'integer',
            ],
            'limit' => [
                'required' => false,
                'type' => 'integer',
                'minimum' => 1,
                'maximum' => 50,
            ],
        ],
    ]);

    register_rest_route('ybb/v1', '/product-reviews-embed/(?P<product_id>\d+)', [
        'methods' => 'GET',
        'permission_callback' => '__return_true',
        'callback' => 'ybb_product_reviews_embed_rest_handler',
        'args' => [
            'product_id' => [
                'required' => true,
                'type' => 'integer',
            ],
        ],
    ]);
}
add_action('rest_api_init', 'ybb_product_reviews_register_rest');

/** Keep iframe on embed URL after comment POST (non-AJAX fallback). */
function ybb_product_reviews_comment_post_redirect(string $location, WP_Comment $comment): string
{
    if (empty($_POST['ybb_review_embed']) || empty($_POST['comment_post_ID'])) {
        return $location;
    }

    $product_id = (int) $_POST['comment_post_ID'];
    if ($product_id <= 0) {
        return $location;
    }

    return add_query_arg(
        'submitted',
        '1',
        home_url('/ybb-product-reviews-embed.php?product_id=' . $product_id)
    );
}
add_filter('comment_post_redirect', 'ybb_product_reviews_comment_post_redirect', 10, 2);

/** Query var for /embed/product-reviews/{id} (non-REST HTML; avoids JSON Content-Type in iframe). */
function ybb_product_reviews_register_embed_query_var(array $vars): array
{
    $vars[] = 'ybb_product_reviews_embed';
    return $vars;
}
add_filter('query_vars', 'ybb_product_reviews_register_embed_query_var');

function ybb_product_reviews_serve_embed_page(): void
{
    $product_id = (int) get_query_var('ybb_product_reviews_embed');
    if ($product_id <= 0 && isset($_GET['ybb_product_reviews_embed'])) {
        $product_id = (int) $_GET['ybb_product_reviews_embed'];
    }
    if ($product_id <= 0) {
        return;
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
}
add_action('template_redirect', 'ybb_product_reviews_serve_embed_page', 0);

function ybb_product_reviews_render_embed_html(int $product_id): string|WP_Error
{
    if (!function_exists('wc_get_product')) {
        return new WP_Error('woocommerce_missing', 'WooCommerce is not active.', ['status' => 503]);
    }

    $product = wc_get_product($product_id);
    if (!$product) {
        return new WP_Error('not_found', 'Product not found.', ['status' => 404]);
    }

    global $post, $wp_query;
    $post = get_post($product_id);
    if (!$post) {
        return new WP_Error('not_found', 'Product not found.', ['status' => 404]);
    }

    setup_postdata($post);
    $wp_query = new WP_Query([
        'p' => $product_id,
        'post_type' => 'product',
    ]);

    ob_start();
    ?>
<!DOCTYPE html>
<html <?php language_attributes(); ?>>
<head>
    <meta charset="<?php bloginfo('charset'); ?>">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title><?php echo esc_html($product->get_name()); ?> �?<?php esc_html_e('Reviews', 'woocommerce'); ?></title>
    <?php
    wp_enqueue_style('woocommerce-general');
    wp_enqueue_style('woocommerce-layout');
    wp_enqueue_style('woocommerce-smallscreen');
    wp_enqueue_script('jquery');
    if (function_exists('WC')) {
        wp_enqueue_script('wc-single-product');
    }
    wp_head();
    ?>
    <style>
      *, *::before, *::after {
        box-sizing: border-box;
      }
      html, body {
        margin: 0;
        padding: 0;
        background: #fff;
        font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
        overflow-x: hidden;
        max-width: 100%;
      }
      body.ybb-reviews-embed {
        padding: 0.875rem 1rem 1.25rem;
      }
      @media (min-width: 480px) {
        body.ybb-reviews-embed {
          padding: 1rem 1.25rem 1.5rem;
        }
      }
      .ybb-reviews-embed #reviews .woocommerce-Reviews-title,
      .ybb-reviews-embed #reviews .woocommerce-noreviews,
      .ybb-reviews-embed #reviews .woocommerce-review__dash,
      .ybb-reviews-embed .commentlist,
      .ybb-reviews-embed #reply-title {
        display: none !important;
      }
      .ybb-reviews-embed .comment-respond {
        margin: 0;
        padding: 0;
        border: 0;
      }
      .ybb-reviews-embed .comment-form {
        margin: 0;
      }
      .ybb-reviews-embed .comment-form label {
        font-size: 0.875rem;
        font-weight: 600;
      }
      .ybb-reviews-embed .comment-form input[type="text"],
      .ybb-reviews-embed .comment-form input[type="email"],
      .ybb-reviews-embed .comment-form textarea {
        width: 100%;
        border: 1px solid #e5e5e5;
        border-radius: 0.75rem;
        padding: 0.75rem 0.875rem;
        font: inherit;
      }
      .ybb-reviews-embed .comment-form textarea {
        min-height: 7rem;
        resize: vertical;
      }
      .ybb-reviews-embed .form-submit input[type="submit"] {
        width: 100%;
        border: 0;
        border-radius: 999px;
        background: #1f1f1f;
        color: #fff;
        padding: 0.8rem 1rem;
        font-size: 0.875rem;
        font-weight: 600;
        cursor: pointer;
      }
      .ybb-reviews-embed .stars a {
        color: #1ebe57;
      }
      .ybb-reviews-embed p.stars {
        display: none !important;
      }
      .ybb-reviews-embed .ybb-star-picker {
        display: inline-flex;
        gap: 0.35rem;
        margin: 0.35rem 0 0.75rem;
      }
      .ybb-reviews-embed .ybb-star-picker button {
        appearance: none;
        border: 0;
        background: transparent;
        padding: 0.15rem;
        line-height: 1;
        cursor: pointer;
        color: #d4d4d4;
        transition: color 0.15s ease, transform 0.15s ease;
      }
      .ybb-reviews-embed .ybb-star-picker button:hover,
      .ybb-reviews-embed .ybb-star-picker button:focus-visible {
        color: #1ebe57;
        transform: scale(1.05);
        outline: none;
      }
      .ybb-reviews-embed .ybb-star-picker button.is-filled {
        color: #1ebe57;
      }
      .ybb-reviews-embed .ybb-star-picker svg {
        width: 1.75rem;
        height: 1.75rem;
        display: block;
        pointer-events: none;
      }
      .ybb-reviews-embed .comment-form-rating.ybb-rating-invalid .ybb-star-picker {
        outline: 2px solid #ef4444;
        outline-offset: 4px;
        border-radius: 0.5rem;
      }
      .ybb-reviews-embed #quorlyx-launcher,
      .ybb-reviews-embed .quorlyx-widget,
      .ybb-reviews-embed .widget_shopping_cart,
      .ybb-reviews-embed .woocommerce-store-notice {
        display: none !important;
      }
      .ybb-reviews-embed .ybb-review-banner {
        margin: 0 0 1rem;
        padding: 0.75rem 1rem;
        border-radius: 0.75rem;
        font-size: 0.875rem;
        line-height: 1.45;
      }
      .ybb-reviews-embed .ybb-review-banner--error {
        border: 1px solid #fecaca;
        background: #fef2f2;
        color: #991b1b;
      }
      .ybb-reviews-embed .ybb-review-banner--success {
        border: 1px solid #bbf7d0;
        background: #f0fdf4;
        color: #166534;
      }
      .ybb-reviews-embed .ybb-review-banner ul {
        margin: 0.35rem 0 0;
        padding-left: 1.1rem;
      }
      .ybb-reviews-embed .comment-form-rating select#rating {
        position: absolute;
        width: 1px;
        height: 1px;
        padding: 0;
        margin: -1px;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
        white-space: nowrap;
        border: 0;
      }
      .ybb-reviews-embed .comment-form-rating select#rating.ybb-rating-invalid {
        outline: none;
      }
      .ybb-reviews-embed .comment-form input.ybb-field-invalid,
      .ybb-reviews-embed .comment-form textarea.ybb-field-invalid {
        border-color: #ef4444 !important;
        box-shadow: 0 0 0 1px #ef4444;
      }
      .ybb-reviews-embed .form-submit input[type="submit"]:disabled {
        opacity: 0.55;
        cursor: wait;
      }
      .ybb-reviews-embed .ybb-photo-field {
        margin: 0.75rem 0 1rem;
      }
      .ybb-reviews-embed .ybb-photo-field label {
        display: block;
        margin-bottom: 0.35rem;
      }
      .ybb-reviews-embed .ybb-photo-field .ybb-photo-hint {
        margin: 0 0 0.65rem;
        font-size: 0.75rem;
        color: #737373;
        line-height: 1.45;
      }
      .ybb-reviews-embed .ybb-photo-picker-btn {
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
        border: 1px dashed #d4d4d4;
        border-radius: 0.75rem;
        background: #fafafa;
        color: #404040;
        padding: 0.55rem 0.85rem;
        font-size: 0.8125rem;
        font-weight: 600;
        cursor: pointer;
      }
      .ybb-reviews-embed .ybb-photo-picker-btn:hover {
        border-color: #a3a3a3;
        background: #f5f5f5;
      }
      .ybb-reviews-embed .ybb-photo-input {
        position: absolute;
        width: 1px;
        height: 1px;
        padding: 0;
        margin: -1px;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
        white-space: nowrap;
        border: 0;
      }
      .ybb-reviews-embed .ybb-photo-preview {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
        margin-top: 0.65rem;
      }
      .ybb-reviews-embed .ybb-photo-preview-item {
        position: relative;
        width: 4.5rem;
        height: 4.5rem;
        border-radius: 0.65rem;
        overflow: hidden;
        border: 1px solid #e5e5e5;
        background: #fff;
      }
      .ybb-reviews-embed .ybb-photo-preview-item img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
      }
      .ybb-reviews-embed .ybb-photo-remove {
        position: absolute;
        top: 0.2rem;
        right: 0.2rem;
        width: 1.35rem;
        height: 1.35rem;
        border: 0;
        border-radius: 999px;
        background: rgb(23 23 23 / 0.72);
        color: #fff;
        font-size: 0.75rem;
        line-height: 1;
        cursor: pointer;
      }
    </style>
</head>
<body class="ybb-reviews-embed woocommerce">
    <div id="reviews" class="woocommerce-Reviews">
        <?php
        if (comments_open($product_id)) {
            comments_template();
        } else {
            echo '<p>' . esc_html__('Reviews are closed for this product.', 'woocommerce') . '</p>';
        }
        ?>
    </div>
    <?php wp_footer(); ?>
    <script>
    (function () {
      var STAR_PATH = 'M12 2l2.9 6.26L22 9.27l-5 4.87L18.18 22 12 18.27 5.82 22 7 14.14l-5-4.87 7.1-1.01L12 2z';

      function initStarPicker() {
        var rating = document.getElementById('rating');
        var ratingWrap = document.querySelector('.comment-form-rating');
        if (!rating || !ratingWrap || ratingWrap.querySelector('.ybb-star-picker')) return;

        var picker = document.createElement('div');
        picker.className = 'ybb-star-picker';
        picker.setAttribute('role', 'radiogroup');
        var label = document.getElementById('comment-form-rating-label');
        if (label && label.id) picker.setAttribute('aria-labelledby', label.id);

        var buttons = [];
        for (var value = 1; value <= 5; value += 1) {
          (function (starValue) {
            var button = document.createElement('button');
            button.type = 'button';
            button.className = 'ybb-star-button';
            button.setAttribute('role', 'radio');
            button.setAttribute('aria-checked', 'false');
            button.setAttribute('aria-label', starValue + ' of 5 stars');
            button.dataset.value = String(starValue);
            button.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="' + STAR_PATH + '"></path></svg>';
            button.addEventListener('click', function () {
              setRating(starValue);
            });
            button.addEventListener('mouseenter', function () {
              paintStars(starValue);
            });
            picker.appendChild(button);
            buttons.push(button);
          })(value);
        }

        picker.addEventListener('mouseleave', function () {
          paintStars(parseInt(rating.value || '0', 10));
        });

        function paintStars(activeValue) {
          buttons.forEach(function (button) {
            var starValue = parseInt(button.dataset.value || '0', 10);
            var filled = activeValue > 0 && starValue <= activeValue;
            button.classList.toggle('is-filled', filled);
            button.setAttribute('aria-checked', filled && starValue === activeValue ? 'true' : 'false');
          });
          ratingWrap.classList.remove('ybb-rating-invalid');
        }

        function setRating(value) {
          rating.value = String(value);
          rating.dispatchEvent(new Event('change', { bubbles: true }));
          paintStars(value);
        }

        ratingWrap.appendChild(picker);
        if (rating.value) paintStars(parseInt(rating.value, 10));
      }

      var params = new URLSearchParams(window.location.search);
      var form = document.getElementById('commentform');
      if (!form) return;
      form.setAttribute('novalidate', 'novalidate');
      form.enctype = 'multipart/form-data';
      initStarPicker();

      var MAX_PHOTOS = <?php echo (int) ybb_product_reviews_max_images(); ?>;
      var MAX_BYTES = <?php echo (int) ybb_product_reviews_max_image_bytes(); ?>;
      var selectedPhotos = [];

      function initPhotoPicker() {
        var commentField = document.getElementById('comment');
        if (!commentField || form.querySelector('.ybb-photo-field')) return;

        var wrap = document.createElement('div');
        wrap.className = 'ybb-photo-field comment-form-comment';
        wrap.innerHTML =
          '<label for="ybb-review-photos">Photos (optional)</label>' +
          '<p class="ybb-photo-hint">Add up to ' + MAX_PHOTOS + ' photos (JPG, PNG or WebP, max 2 MB each).</p>' +
          '<input class="ybb-photo-input" id="ybb-review-photos" type="file" accept="image/jpeg,image/png,image/webp" multiple />' +
          '<button type="button" class="ybb-photo-picker-btn">Add photos</button>' +
          '<div class="ybb-photo-preview" hidden></div>';

        var commentWrap = commentField.closest('p') || commentField.parentElement;
        if (commentWrap && commentWrap.parentElement) {
          commentWrap.parentElement.insertBefore(wrap, commentWrap.nextSibling);
        } else {
          form.insertBefore(wrap, form.querySelector('.form-submit'));
        }

        var input = wrap.querySelector('#ybb-review-photos');
        var pickBtn = wrap.querySelector('.ybb-photo-picker-btn');
        var preview = wrap.querySelector('.ybb-photo-preview');

        pickBtn.addEventListener('click', function () {
          input.click();
        });

        input.addEventListener('change', function () {
          var files = Array.prototype.slice.call(input.files || []);
          input.value = '';
          files.forEach(function (file) {
            if (selectedPhotos.length >= MAX_PHOTOS) return;
            if (file.size > MAX_BYTES) return;
            if (!/^image\/(jpeg|png|webp)$/i.test(file.type)) return;
            selectedPhotos.push(file);
          });
          renderPhotoPreview();
        });

        function renderPhotoPreview() {
          preview.innerHTML = '';
          if (!selectedPhotos.length) {
            preview.hidden = true;
            return;
          }
          preview.hidden = false;
          selectedPhotos.forEach(function (file, index) {
            var item = document.createElement('div');
            item.className = 'ybb-photo-preview-item';
            var img = document.createElement('img');
            img.alt = '';
            img.src = URL.createObjectURL(file);
            var remove = document.createElement('button');
            remove.type = 'button';
            remove.className = 'ybb-photo-remove';
            remove.setAttribute('aria-label', 'Remove photo');
            remove.textContent = '×';
            remove.addEventListener('click', function () {
              selectedPhotos.splice(index, 1);
              renderPhotoPreview();
            });
            item.appendChild(img);
            item.appendChild(remove);
            preview.appendChild(item);
          });
        }
      }
      initPhotoPicker();

      var bannerHost = document.getElementById('reviews') || document.body;
      var banner = document.createElement('div');
      banner.id = 'ybb-review-banner';
      banner.setAttribute('role', 'status');
      banner.setAttribute('aria-live', 'polite');
      banner.className = 'ybb-review-banner';
      banner.hidden = true;
      bannerHost.insertBefore(banner, bannerHost.firstChild);

      var embedField = document.createElement('input');
      embedField.type = 'hidden';
      embedField.name = 'ybb_review_embed';
      embedField.value = '1';
      form.appendChild(embedField);

      function showBanner(kind, html) {
        banner.hidden = false;
        banner.className = 'ybb-review-banner ybb-review-banner--' + kind;
        banner.innerHTML = html;
      }

      function clearFieldErrors() {
        form.querySelectorAll('.ybb-field-invalid').forEach(function (el) {
          el.classList.remove('ybb-field-invalid');
        });
        var rating = document.getElementById('rating');
        if (rating) rating.classList.remove('ybb-rating-invalid');
        var ratingWrap = document.querySelector('.comment-form-rating');
        if (ratingWrap) ratingWrap.classList.remove('ybb-rating-invalid');
      }

      function validateForm() {
        clearFieldErrors();
        var errors = [];
        var rating = document.getElementById('rating');
        var comment = document.getElementById('comment');
        var author = document.getElementById('author');
        var email = document.getElementById('email');

        if (rating && !rating.value) {
          errors.push('Please select a star rating.');
          var ratingWrapInvalid = document.querySelector('.comment-form-rating');
          if (ratingWrapInvalid) ratingWrapInvalid.classList.add('ybb-rating-invalid');
        }
        if (comment && !comment.value.trim()) {
          errors.push('Please write your review.');
          comment.classList.add('ybb-field-invalid');
        }
        if (author && !author.value.trim()) {
          errors.push('Please enter your name.');
          author.classList.add('ybb-field-invalid');
        }
        if (email) {
          if (!email.value.trim()) {
            errors.push('Please enter your email address.');
            email.classList.add('ybb-field-invalid');
          } else if (!email.checkValidity()) {
            errors.push('Please enter a valid email address (for example name@example.com).');
            email.classList.add('ybb-field-invalid');
          }
        }

        if (selectedPhotos.length > MAX_PHOTOS) {
          errors.push('You can attach up to ' + MAX_PHOTOS + ' photos.');
        }
        selectedPhotos.forEach(function (file) {
          if (file.size > MAX_BYTES) {
            errors.push('Each photo must be 2 MB or smaller.');
          }
          if (!/^image\/(jpeg|png|webp)$/i.test(file.type)) {
            errors.push('Only JPG, PNG and WebP photos are allowed.');
          }
        });

        if (errors.length) {
          showBanner('error', '<strong>Could not submit review</strong><ul><li>' + errors.join('</li><li>') + '</li></ul>');
          if (errors[0] && rating && !rating.value) {
            var picker = document.querySelector('.ybb-star-picker');
            if (picker) picker.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
          }
          return false;
        }
        return true;
      }

      function notifyParent() {
        try {
          window.parent.postMessage({ type: 'ybb-review-submitted' }, window.location.origin);
        } catch (e) {}
      }

      function showSuccess() {
        showBanner('success', '<strong>Thank you!</strong> Your review has been published.');
        form.hidden = true;
        notifyParent();
      }

      if (params.get('submitted') === '1') {
        showSuccess();
        return;
      }

      function handleSubmit(event) {
        if (event) event.preventDefault();
        banner.hidden = true;
        if (!validateForm()) return;

        var submitBtn = form.querySelector('#submit');
        if (submitBtn) submitBtn.disabled = true;

        var body = new FormData(form);
        selectedPhotos.forEach(function (file) {
          body.append('ybb_review_images[]', file, file.name);
        });

        fetch(form.action, {
          method: 'POST',
          body: body,
          credentials: 'same-origin',
          redirect: 'manual',
        })
          .then(function (response) {
            if (response.type === 'opaqueredirect' || response.status === 0) {
              showSuccess();
              return;
            }
            if (response.status >= 200 && response.status < 400) {
              showSuccess();
              return;
            }
            if (response.status === 429) {
              showBanner('error', '<strong>Too many attempts</strong><p>Please wait a moment and try again.</p>');
              return;
            }
            return response.text().then(function (text) {
              var snippet = text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 180);
              showBanner('error', '<strong>Could not submit review</strong><p>' + (snippet || 'Unexpected server response (HTTP ' + response.status + ').') + '</p>');
            });
          })
          .catch(function () {
            showBanner('error', '<strong>Could not submit review</strong><p>Network error. Please try again.</p>');
          })
          .finally(function () {
            if (submitBtn) submitBtn.disabled = false;
          });
      }

      form.addEventListener('submit', handleSubmit);
      var submitBtn = form.querySelector('#submit');
      if (submitBtn) {
        submitBtn.addEventListener('click', function (event) {
          event.preventDefault();
          handleSubmit(event);
        });
      }
    })();
    </script>
</body>
</html>
    <?php
    $html = (string) ob_get_clean();
    wp_reset_postdata();

    return $html;
}

function ybb_product_reviews_embed_rest_handler(WP_REST_Request $request): WP_REST_Response|WP_Error
{
    $product_id = (int) $request['product_id'];
    if ($product_id <= 0) {
        return new WP_Error('invalid_id', 'Invalid product id.', ['status' => 400]);
    }

    $html = ybb_product_reviews_render_embed_html($product_id);
    if (is_wp_error($html)) {
        return $html;
    }

    $response = new WP_REST_Response($html, 200);
    $response->header('Content-Type', 'text/html; charset=UTF-8');
    $response->header('X-Content-Type-Options', 'nosniff');
    return $response;
}

function ybb_product_reviews_embed_response_headers($response, WP_REST_Server $server, WP_REST_Request $request): WP_REST_Response
{
    if (str_starts_with($request->get_route(), '/ybb/v1/product-reviews-embed/')) {
        $response->header('Content-Type', 'text/html; charset=UTF-8');
    }
    return $response;
}
add_filter('rest_post_dispatch', 'ybb_product_reviews_embed_response_headers', 20, 3);

function ybb_product_reviews_serve_embed_html(bool $served, $result, WP_REST_Request $request, WP_REST_Server $server): bool
{
    if ($served || !str_starts_with($request->get_route(), '/ybb/v1/product-reviews-embed/')) {
        return $served;
    }

    if ($result instanceof WP_REST_Response) {
        $data = $result->get_data();
        if (is_string($data)) {
            status_header($result->get_status());
            foreach ($result->get_headers() as $key => $value) {
                if (strtolower($key) === 'content-type') {
                    header($key . ': ' . $value, true);
                } else {
                    header($key . ': ' . $value);
                }
            }
            header('Content-Type: text/html; charset=UTF-8', true);
            echo $data;
            return true;
        }
    }

    return $served;
}
add_filter('rest_pre_serve_request', 'ybb_product_reviews_serve_embed_html', 10, 4);

function ybb_product_reviews_admin_notice(): void
{
    if (!current_user_can('manage_options')) {
        return;
    }
    $screen = function_exists('get_current_screen') ? get_current_screen() : null;
    if (!$screen || $screen->id !== 'options-general') {
        return;
    }
    echo '<div class="notice notice-info"><p><strong>YBB Product Reviews REST:</strong> '
        . esc_html(rest_url('ybb/v1/product-reviews/{product_id}'))
        . '</p></div>';
}
add_action('admin_notices', 'ybb_product_reviews_admin_notice');

define('YBB_PR_DIR', __DIR__ . '/ybb-product-reviews');
if (is_dir(YBB_PR_DIR)) {
    require_once YBB_PR_DIR . '/includes/review-import-engine.php';
    require_once YBB_PR_DIR . '/includes/review-import-admin.php';
}
