<?php

if (!defined('ABSPATH')) {
    exit;
}

/**
 * Richer WooCommerce product Description editor + operator hints.
 */
add_filter('tiny_mce_before_init', static function (array $settings): array {
    if (!is_admin() || !function_exists('get_current_screen')) {
        return $settings;
    }

    $screen = get_current_screen();
    if (!$screen || $screen->post_type !== 'product') {
        return $settings;
    }

    $settings['wordpress_adv_hidden'] = false;
    $settings['wpautop'] = true;
    $settings['toolbar1'] = 'formatselect,bold,italic,bullist,numlist,blockquote,hr,alignleft,aligncenter,alignright,link,unlink,wp_adv';
    $settings['toolbar2'] = 'strikethrough,hr,forecolor,pastetext,removeformat,charmap,outdent,indent,undo,redo,wp_help';

    return $settings;
}, 20);

add_filter('wp_editor_settings', static function (array $settings, string $editor_id): array {
    if (!is_admin() || $editor_id !== 'content' || !function_exists('get_current_screen')) {
        return $settings;
    }

    $screen = get_current_screen();
    if (!$screen || $screen->post_type !== 'product') {
        return $settings;
    }

    $settings['teeny'] = false;
    $settings['quicktags'] = true;
    $settings['media_buttons'] = true;

    return $settings;
}, 10, 2);

add_action('admin_enqueue_scripts', static function (string $hook): void {
    if ($hook !== 'post.php' && $hook !== 'post-new.php') {
        return;
    }

    $screen = get_current_screen();
    if (!$screen || $screen->post_type !== 'product') {
        return;
    }

    wp_add_inline_style(
        'wp-admin',
        '#postdivrich .wp-editor-tools { max-width: none; }'
        . '.ybb-wc-desc-hint { margin: 8px 0 0; padding: 8px 12px; background: #f0f6fc; border-left: 4px solid #2271b1; font-size: 13px; line-height: 1.5; }'
    );
});

add_action('edit_form_after_editor', static function (WP_Post $post): void {
    if ($post->post_type !== 'product') {
        return;
    }

    echo '<p class="ybb-wc-desc-hint">';
    echo esc_html__(
        'Description formatting: Enter = new paragraph (blank line between blocks). Shift+Enter = line break within a paragraph. Toolbar: bullets, headings (Format), horizontal rule. After save, hard-refresh the product page on the storefront.',
        'ybb-site-manager'
    );
    echo '</p>';
});
