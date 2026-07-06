<?php
/**
 * Flat My Account page shell �?WooCommerce account shortcode inside.
 *
 * @package YBB_My_Account
 */

if (!defined('ABSPATH')) {
    exit;
}

$next_base_url = untrailingslashit(apply_filters('ybb_my_account_next_base_url', home_url('/')));
$t = ybb_my_account_strings();
$current_lang = function_exists('ybb_get_active_locale')
    ? ybb_get_active_locale()
    : (function_exists('determine_locale') ? substr(determine_locale(), 0, 2) : 'en');
$nav_links = ybb_my_account_nav_links();
$cart_url = apply_filters('ybb_flat_checkout_cart_url', 'https://carp-ybb.com/cart/');
$html_lang = function_exists('ybb_locale_html_lang')
    ? ybb_locale_html_lang($current_lang)
    : $current_lang;

?><!doctype html>
<html <?php language_attributes(); ?> lang="<?php echo esc_attr($html_lang); ?>">
<head>
    <meta charset="<?php bloginfo('charset'); ?>">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    <?php wp_head(); ?>
</head>
<body <?php body_class('ybb-account-page woocommerce-account'); ?>>
<?php wp_body_open(); ?>

<main class="ybb-account-shell" lang="<?php echo esc_attr($current_lang); ?>">
    <header class="ybb-account-topbar">
        <a class="ybb-brand" href="<?php echo esc_url($next_base_url . '/'); ?>" aria-label="<?php echo esc_attr($t['home']); ?>">
            <?php if (has_custom_logo()) : ?>
                <?php the_custom_logo(); ?>
            <?php else : ?>
                <img
                    class="ybb-brand-logo"
                    src="<?php echo esc_url($next_base_url . '/images/brand/ybb-logo.png'); ?>"
                    alt="<?php echo esc_attr(get_bloginfo('name')); ?>"
                    width="52"
                    height="52"
                />
            <?php endif; ?>
            <div>
                <div class="ybb-brand-name"><?php bloginfo('name'); ?></div>
                <div class="ybb-brand-tagline"><?php bloginfo('description'); ?></div>
            </div>
        </a>

        <nav class="ybb-site-nav" aria-label="<?php echo esc_attr($t['home']); ?>">
            <ul class="ybb-site-nav-list">
                <?php foreach ($nav_links as $link) : ?>
                    <li>
                        <a class="ybb-nav-pill" href="<?php echo esc_url($link['url']); ?>">
                            <?php echo esc_html($link['label']); ?>
                        </a>
                    </li>
                <?php endforeach; ?>
            </ul>
        </nav>

        <div class="ybb-account-topbar-actions">
            <a class="ybb-utility-link" href="<?php echo esc_url($cart_url); ?>"><?php echo esc_html($t['cart']); ?></a>
            <span class="ybb-account-badge"><?php echo esc_html($t['account']); ?></span>
            <?php
            if (function_exists('ybb_render_locale_switcher')) {
                ybb_render_locale_switcher('ybb-lang');
            }
            ?>
        </div>
    </header>

    <div class="ybb-crumb"><?php echo esc_html($t['crumb']); ?></div>

    <div class="ybb-account-content">
        <?php
        while (have_posts()) {
            the_post();
            echo do_shortcode('[woocommerce_my_account]');
        }
        ?>
    </div>
</main>

<?php wp_footer(); ?>
</body>
</html>
