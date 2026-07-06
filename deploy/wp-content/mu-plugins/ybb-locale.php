<?php
/**
 * Plugin Name: YBB Locale
 * Description: Shared en/zh/ja locale for WooCommerce shells (cookie + ?lang= + Next localStorage sync).
 * Version: 1.0.0
 */

if (!defined('ABSPATH')) {
    exit;
}

define('YBB_LOCALE_COOKIE', 'ybb_locale');
define('YBB_LOCALE_STORAGE_KEY', 'ybb-locale');

/**
 * @return list<string>
 */
function ybb_supported_locales(): array
{
    return array('en', 'zh', 'ja');
}

/**
 * @return array<string, string>
 */
function ybb_locale_short_labels(): array
{
    return array(
        'en' => 'EN',
        'zh' => '中文',
        'ja' => '日本�?,
    );
}

/**
 * @return array<string, string>
 */
function ybb_locale_to_wp_map(): array
{
    return array(
        'en' => 'en_US',
        'zh' => 'zh_CN',
        'ja' => 'ja',
    );
}

function ybb_locale_to_wp(string $code): string
{
    $map = ybb_locale_to_wp_map();
    return $map[$code] ?? 'en_US';
}

function ybb_wp_to_locale(string $wp_locale): string
{
    if (str_starts_with($wp_locale, 'zh')) {
        return 'zh';
    }
    if (str_starts_with($wp_locale, 'ja')) {
        return 'ja';
    }

    return 'en';
}

function ybb_locale_capture_request(): void
{
    if (!isset($_GET['lang'])) {
        return;
    }

    $lang = sanitize_key(wp_unslash((string) $_GET['lang']));
    if (!in_array($lang, ybb_supported_locales(), true)) {
        return;
    }

    if (!headers_sent()) {
        $secure = is_ssl();
        setcookie(
            YBB_LOCALE_COOKIE,
            $lang,
            time() + YEAR_IN_SECONDS,
            COOKIEPATH ?: '/',
            COOKIE_DOMAIN,
            $secure,
            false
        );
    }

    $_COOKIE[YBB_LOCALE_COOKIE] = $lang;
}

add_action('init', 'ybb_locale_capture_request', 0);

add_filter('determine_locale', static function (string $locale): string {
    if (is_admin() && !wp_doing_ajax()) {
        return $locale;
    }

    if (!ybb_locale_should_override_wp_locale()) {
        return $locale;
    }

    return ybb_locale_to_wp(ybb_get_active_locale());
}, 20);

/**
 * Limit WP/Woo locale override to storefront account/checkout/cart routes.
 */
function ybb_locale_should_override_wp_locale(): bool
{
    $uri = isset($_SERVER['REQUEST_URI']) ? (string) wp_unslash($_SERVER['REQUEST_URI']) : '';
    return (bool) preg_match('#^/(my-account|checkout|cart)(/|$)#i', $uri);
}

/**
 * Active site locale code: en | zh | ja
 */
function ybb_get_active_locale(): string
{
    static $resolved = null;
    if ($resolved !== null) {
        return $resolved;
    }

    if (isset($_GET['lang'])) {
        $candidate = sanitize_key(wp_unslash((string) $_GET['lang']));
        if (in_array($candidate, ybb_supported_locales(), true)) {
            $resolved = $candidate;
            return $resolved;
        }
    }

    if (isset($_COOKIE[YBB_LOCALE_COOKIE])) {
        $candidate = sanitize_key(wp_unslash((string) $_COOKIE[YBB_LOCALE_COOKIE]));
        if (in_array($candidate, ybb_supported_locales(), true)) {
            $resolved = $candidate;
            return $resolved;
        }
    }

    $resolved = 'en';
    return $resolved;
}

function ybb_locale_switch_url(string $code): string
{
    if (!in_array($code, ybb_supported_locales(), true)) {
        $code = 'en';
    }

    return add_query_arg('lang', $code);
}

function ybb_locale_html_lang(string $code): string
{
    $map = array(
        'en' => 'en',
        'zh' => 'zh-CN',
        'ja' => 'ja',
    );

    return $map[$code] ?? 'en';
}

/**
 * @return void
 */
function ybb_enqueue_locale_sync_script(): void
{
    $inline = <<<'JS'
(function () {
  var KEY = "ybb-locale";
  var COOKIE = "ybb_locale";
  var allowed = ["en", "zh", "ja"];

  function readCookie() {
    var parts = document.cookie.split(";");
    for (var i = 0; i < parts.length; i++) {
      var piece = parts[i].trim();
      if (piece.indexOf(COOKIE + "=") === 0) {
        return decodeURIComponent(piece.substring(COOKIE.length + 1));
      }
    }
    return null;
  }

  function writeStorage(code) {
    try { localStorage.setItem(KEY, code); } catch (e) {}
  }

  var cookieLocale = readCookie();
  if (cookieLocale && allowed.indexOf(cookieLocale) >= 0) {
    writeStorage(cookieLocale);
  } else {
    var stored = null;
    try { stored = localStorage.getItem(KEY); } catch (e) {}
    if (stored && allowed.indexOf(stored) >= 0) {
      var url = new URL(window.location.href);
      if (!url.searchParams.has("lang")) {
        url.searchParams.set("lang", stored);
        window.location.replace(url.toString());
        return;
      }
    }
  }

  document.querySelectorAll("[data-ybb-locale]").forEach(function (node) {
    node.addEventListener("click", function () {
      var code = node.getAttribute("data-ybb-locale");
      if (code && allowed.indexOf(code) >= 0) {
        writeStorage(code);
      }
    });
  });
})();
JS;

    wp_register_script('ybb-locale-sync', '', array(), '1.0.0', true);
    wp_enqueue_script('ybb-locale-sync');
    wp_add_inline_script('ybb-locale-sync', $inline);
}

/**
 * Render EN / 中文 / 日本�?switcher links.
 */
function ybb_render_locale_switcher(string $class = 'ybb-lang'): void
{
    $active = ybb_get_active_locale();
    $labels = ybb_locale_short_labels();
    $codes = ybb_supported_locales();

    echo '<div class="' . esc_attr($class) . '" aria-label="Language">';
    foreach ($codes as $index => $code) {
        if ($index > 0) {
            echo '<span class="ybb-lang-sep">/</span>';
        }
        $classes = array('ybb-lang-link');
        if ($code === $active) {
            $classes[] = 'is-active';
        }
        printf(
            '<a class="%s" href="%s" data-ybb-locale="%s" lang="%s">%s</a>',
            esc_attr(implode(' ', $classes)),
            esc_url(ybb_locale_switch_url($code)),
            esc_attr($code),
            esc_attr(ybb_locale_html_lang($code)),
            esc_html($labels[$code] ?? strtoupper($code))
        );
    }
    echo '</div>';
}
