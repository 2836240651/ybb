<?php
/**
 * Flat checkout page shell �?real WooCommerce checkout form inside.
 *
 * @package YBB_Flat_Checkout
 */

if (!defined('ABSPATH')) {
    exit;
}

if (!function_exists('WC') || !WC()->cart || WC()->cart->is_empty()) {
    wp_safe_redirect(wc_get_cart_url());
    exit;
}

$next_base_url = untrailingslashit(apply_filters('ybb_checkout_next_base_url', home_url('/')));
$t = ybb_flat_checkout_strings();
$current_lang = function_exists('ybb_get_active_locale')
    ? ybb_get_active_locale()
    : (function_exists('determine_locale') ? substr(determine_locale(), 0, 2) : 'en');

$nav_links = array(
    array('label' => $t['home'], 'url' => $next_base_url . '/'),
    array('label' => $t['shop'], 'url' => $next_base_url . '/collections/new-arrivals/'),
    array('label' => $t['oem'], 'url' => $next_base_url . '/pages/oem-odm/'),
    array('label' => $t['contact'], 'url' => $next_base_url . '/contact/'),
);

$cart_url = apply_filters('ybb_flat_checkout_cart_url', 'https://carp-ybb.com/cart/');

?><!doctype html>
<html <?php language_attributes(); ?>>
<head>
    <meta charset="<?php bloginfo('charset'); ?>">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <?php wp_head(); ?>
</head>
<body <?php body_class('ybb-checkout-page woocommerce-checkout'); ?>>
<?php wp_body_open(); ?>

<main class="ybb-checkout-page" lang="<?php echo esc_attr($current_lang); ?>">
    <header class="ybb-checkout-topbar">
        <a class="ybb-brand" href="<?php echo esc_url($next_base_url . '/'); ?>" aria-label="<?php echo esc_attr($t['home']); ?>">
            <?php if (has_custom_logo()) : ?>
                <?php the_custom_logo(); ?>
            <?php else : ?>
                <div class="ybb-logo-fallback">YBB</div>
            <?php endif; ?>
            <div>
                <div class="ybb-brand-name"><?php bloginfo('name'); ?></div>
                <div class="ybb-brand-tagline"><?php bloginfo('description'); ?></div>
            </div>
        </a>
        <nav class="ybb-nav" aria-label="Checkout navigation">
            <?php foreach ($nav_links as $link) : ?>
                <a href="<?php echo esc_url($link['url']); ?>"><?php echo esc_html($link['label']); ?></a>
            <?php endforeach; ?>
            <span><?php echo esc_html($t['checkout']); ?><span class="ybb-badge"><?php echo esc_html($t['step']); ?></span></span>
        </nav>
        <?php
        if (function_exists('ybb_render_locale_switcher')) {
            ybb_render_locale_switcher('ybb-lang');
        }
        ?>
    </header>

    <div class="ybb-crumb"><?php echo esc_html($t['crumb']); ?></div>

    <p class="ybb-back-to-cart-wrap">
        <a class="ybb-back-to-cart" href="<?php echo esc_url($cart_url); ?>">
            <?php echo esc_html($t['back_to_cart']); ?>
        </a>
    </p>

    <div class="ybb-checkout-content">
        <?php
        /**
         * Always render the checkout form. Woo's [woocommerce_checkout] shortcode
         * swaps to cart-errors.php (blank shell) when error notices exist �?e.g.
         * duplicate coupon �?which leaves only the notice and no billing form.
         */
        woocommerce_output_all_notices();

        $checkout = WC()->checkout();

        if (
            ! $checkout->is_registration_enabled()
            && $checkout->is_registration_required()
            && ! is_user_logged_in()
        ) {
            echo esc_html(
                apply_filters(
                    'woocommerce_checkout_must_be_logged_in_message',
                    __('You must be logged in to checkout.', 'woocommerce')
                )
            );
        } else {
            wc_get_template('checkout/form-checkout.php', array('checkout' => $checkout));
        }
        ?>
        <p class="ybb-small ybb-safe-note"><?php echo esc_html($t['safe']); ?></p>
    </div>
</main>

<?php wp_footer(); ?>
</body>
</html>
