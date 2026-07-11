<?php
/**
 * Plugin Name: YBB Quorlyx Embed
 * Description: Bootstrap Quorlyx chat widget for static Next.js frontend.
 * Version: 1.0.0
 */

if (!defined('ABSPATH')) {
    exit;
}

function ybb_quorlyx_plugin_active(): bool
{
    if (!function_exists('quorlyx_enqueue_frontend_scripts')) {
        return false;
    }

    if (!function_exists('is_plugin_active')) {
        require_once ABSPATH . 'wp-admin/includes/plugin.php';
    }

    return is_plugin_active('quorlyx/quorlyx.php');
}

/**
 * Run Quorlyx frontend enqueue and extract assets + localized vars.
 *
 * @return array<string,mixed>|null
 */
function ybb_quorlyx_collect_enqueue_payload(): ?array
{
    if (!ybb_quorlyx_plugin_active()) {
        return null;
    }

    global $wp_scripts, $wp_styles;

    if (!wp_style_is('quorlyx-style', 'registered')) {
        quorlyx_enqueue_frontend_scripts();
    }

    $payload = [
        'enabled' => false,
        'styleUrl' => '',
        'scriptUrl' => '',
        'inlineCss' => '',
        'vars' => null,
    ];

    if (isset($wp_styles->registered['quorlyx-style'])) {
        $payload['styleUrl'] = (string) $wp_styles->registered['quorlyx-style']->src;
        $after = $wp_styles->get_data('quorlyx-style', 'after');
        if (is_array($after)) {
            $payload['inlineCss'] = implode("\n", $after);
        }
    }

    $payload['inlineCss'] .= "\n" . ybb_quorlyx_position_override_css();

    if (!isset($wp_scripts->registered['quorlyx-frontend'])) {
        return $payload;
    }

    $payload['scriptUrl'] = (string) $wp_scripts->registered['quorlyx-frontend']->src;
    $localized = $wp_scripts->registered['quorlyx-frontend']->extra['data'] ?? '';
    if (is_string($localized) && preg_match('/var quorlyxVars = (\{.*\});/s', $localized, $matches)) {
        $vars = json_decode($matches[1], true);
        if (is_array($vars) && !empty($vars['restUrl'])) {
            $payload['vars'] = $vars;
            $payload['enabled'] = true;
        }
    }

    return $payload;
}

/**
 * Raise Quorlyx launcher +100px (default 20px �?120px) for visibility.
 */
function ybb_quorlyx_position_override_css(): string
{
    $fab = 120;
    $panel = 195;

    return <<<CSS
/* YBB �?Quorlyx launcher offset (+100px above plugin default 20px) */
@media (min-width: 769px) {
    .quorlyx-floating-button-container,
    #quorlyx-root .quorlyx-floating-button-container,
    #quorlyx-root .quorlyx-floating-button,
    #quorlyx-root .quorlyx-launcher,
    .quorlyx-fab-wrap,
    #quorlyx-root .quorlyx-fab-wrap.quorlyx-fab-wrap {
        bottom: {$fab}px !important;
    }
    .quorlyx-chat-panel:not(.quorlyx-exit-intent-modal) {
        bottom: {$panel}px !important;
    }
}
@media (max-width: 768px) {
    .quorlyx-floating-button-container,
    #quorlyx-root .quorlyx-floating-button-container,
    #quorlyx-root .quorlyx-floating-button,
    #quorlyx-root .quorlyx-launcher,
    .quorlyx-fab-wrap,
    #quorlyx-root .quorlyx-fab-wrap.quorlyx-fab-wrap {
        bottom: {$fab}px !important;
    }
}
CSS;
}

function ybb_quorlyx_bootstrap_response(): WP_REST_Response
{
    $payload = ybb_quorlyx_collect_enqueue_payload();
    if ($payload === null) {
        return rest_ensure_response([
            'enabled' => false,
            'reason' => 'quorlyx_inactive',
        ]);
    }

    // Static Next.js pages cannot satisfy wp_rest cookie nonce checks on /quorlyx/v1/*.
    // Route chat traffic through YBB proxy endpoints that rely on chatToken + same-origin.
    if (is_array($payload['vars'] ?? null)) {
        $payload['vars']['restUrl'] = esc_url_raw(rest_url('ybb/v1/quorlyx/'));
    }

    return rest_ensure_response($payload);
}

/**
 * Same-origin check for public chat proxy (mirrors Quorlyx).
 */
function ybb_quorlyx_public_origin_ok(WP_REST_Request $request): bool
{
    if (function_exists('quorlyx_public_rest_request_has_same_origin')) {
        return quorlyx_public_rest_request_has_same_origin($request);
    }

    $site_host = wp_parse_url(home_url(), PHP_URL_HOST);
    $site_host = is_string($site_host) ? strtolower($site_host) : '';
    if ($site_host === '') {
        return true;
    }

    foreach ([$request->get_header('origin'), $request->get_header('referer')] as $header_value) {
        $header_value = is_string($header_value) ? trim($header_value) : '';
        if ($header_value === '') {
            continue;
        }
        $request_host = wp_parse_url($header_value, PHP_URL_HOST);
        $request_host = is_string($request_host) ? strtolower($request_host) : '';
        if ($request_host === $site_host) {
            return true;
        }
        return false;
    }

    return true;
}

/**
 * Static frontend sends X-WP-Nonce from bootstrap but lacks WP cookie session.
 * Clear cookie nonce errors for YBB Quorlyx proxy routes (chatToken still required).
 */
add_filter('rest_authentication_errors', function ($result) {
    if (!($result instanceof WP_Error) || $result->get_error_code() !== 'rest_cookie_invalid_nonce') {
        return $result;
    }

    $uri = isset($_SERVER['REQUEST_URI']) ? (string) $_SERVER['REQUEST_URI'] : '';
    if (strpos($uri, '/ybb/v1/quorlyx/') !== false && strpos($uri, 'quorlyx-bootstrap') === false) {
        return null;
    }

    return $result;
}, 100);

/**
 * @return true|WP_Error
 */
function ybb_quorlyx_proxy_permission(WP_REST_Request $request)
{
    if (!ybb_quorlyx_public_origin_ok($request)) {
        return new WP_Error(
            'invalid_origin',
            'Security check failed. Please refresh and try again.',
            ['status' => 403]
        );
    }

    return true;
}

add_action('wp_enqueue_scripts', function (): void {
    if (!ybb_quorlyx_plugin_active()) {
        return;
    }
    if (!wp_style_is('quorlyx-style', 'enqueued') && !wp_style_is('quorlyx-style', 'registered')) {
        return;
    }
    wp_add_inline_style('quorlyx-style', ybb_quorlyx_position_override_css());
}, 100);

add_action('rest_api_init', function () {
    register_rest_route('ybb/v1', '/quorlyx-bootstrap', [
        'methods' => 'GET',
        'permission_callback' => '__return_true',
        'callback' => 'ybb_quorlyx_bootstrap_response',
    ]);

    $proxy_routes = [
        'ask-ai' => 'quorlyx_proxy_handler',
        'get-history' => 'quorlyx_get_history_handler',
    ];

    foreach ($proxy_routes as $path => $handler) {
        register_rest_route('ybb/v1', '/quorlyx/' . $path, [
            'methods' => 'POST',
            'permission_callback' => 'ybb_quorlyx_proxy_permission',
            'callback' => static function (WP_REST_Request $request) use ($handler) {
                if (!function_exists($handler)) {
                    return new WP_Error('quorlyx_missing', 'Quorlyx handler unavailable.', ['status' => 503]);
                }

                return $handler($request);
            },
        ]);
    }
});
