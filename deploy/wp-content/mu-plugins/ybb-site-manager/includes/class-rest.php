<?php

if (!defined('ABSPATH')) {
    exit;
}

require_once YBB_SM_DIR . '/includes/class-sanitize.php';

add_action('rest_api_init', function () {
    $public = static fn () => true;

    register_rest_route('ybb/v1', '/site-manager/navigation', [
        'methods' => 'GET',
        'permission_callback' => $public,
        'callback' => static fn () => rest_ensure_response(ybb_sm_navigation_public()),
    ]);

    register_rest_route('ybb/v1', '/site-manager/announcements', [
        'methods' => 'GET',
        'permission_callback' => $public,
        'callback' => static fn () => rest_ensure_response(ybb_sm_announcements_public()),
    ]);

    register_rest_route('ybb/v1', '/site-manager/hero', [
        'methods' => 'GET',
        'permission_callback' => $public,
        'callback' => static fn () => rest_ensure_response(ybb_sm_hero_public()),
    ]);

    register_rest_route('ybb/v1', '/site-manager/blog', [
        'methods' => 'GET',
        'permission_callback' => $public,
        'callback' => static fn () => rest_ensure_response(ybb_sm_blog_public()),
    ]);

    register_rest_route('ybb/v1', '/site-manager/product-overrides', [
        'methods' => 'GET',
        'permission_callback' => $public,
        'callback' => static fn () => rest_ensure_response(ybb_sm_product_overrides_public()),
    ]);

    $product_live_get = static function (WP_REST_Request $request) {
        $handle = sanitize_title((string) $request->get_param('handle'));
        $payload = ybb_sm_product_live_payload($handle);
        if (!$payload) {
            return new WP_Error('not_found', 'Product not found.', ['status' => 404]);
        }

        return rest_ensure_response($payload);
    };

    register_rest_route('ybb/v1', '/site-manager/product-live/(?P<handle>[a-z0-9-]+)', [
        'methods' => 'GET',
        'permission_callback' => $public,
        'callback' => $product_live_get,
    ]);

    // Legacy alias for older clients / scripts.
    register_rest_route('ybb/v1', '/site-manager/product-overrides/(?P<handle>[a-z0-9-]+)', [
        'methods' => 'GET',
        'permission_callback' => $public,
        'callback' => $product_live_get,
    ]);

    register_rest_route('ybb/v1', '/site-manager/product-overrides/(?P<handle>[a-z0-9-]+)', [
        'methods' => 'POST',
        'permission_callback' => static fn () => current_user_can('manage_options'),
        'callback' => static function (WP_REST_Request $request) {
            $handle = sanitize_title((string) $request->get_param('handle'));
            $body = $request->get_json_params();
            if (!is_array($body)) {
                $body = [];
            }
            $result = ybb_sm_product_save_override($handle, $body);
            if (is_wp_error($result)) {
                return $result;
            }

            return rest_ensure_response($result);
        },
    ]);

    register_rest_route('ybb/v1', '/site-manager/product-catalog', [
        'methods' => 'GET',
        'permission_callback' => static fn () => current_user_can('manage_options'),
        'callback' => static function (WP_REST_Request $request) {
            return rest_ensure_response(ybb_sm_product_catalog_public($request));
        },
    ]);

    register_rest_route('ybb/v1', '/site-manager/factory-video', [
        'methods' => 'GET',
        'permission_callback' => $public,
        'callback' => static fn () => rest_ensure_response(ybb_sm_video_public()),
    ]);

    register_rest_route('ybb/v1', '/site-manager/featured-product', [
        'methods' => 'GET',
        'permission_callback' => $public,
        'callback' => static fn () => rest_ensure_response(ybb_sm_featured_public()),
    ]);

    register_rest_route('ybb/v1', '/site-manager/contact', [
        'methods' => 'GET',
        'permission_callback' => $public,
        'callback' => static fn () => rest_ensure_response(ybb_sm_contact_public()),
    ]);

    register_rest_route('ybb/v1', '/home-settings', [
        'methods' => 'GET',
        'permission_callback' => $public,
        'callback' => static fn () => rest_ensure_response(ybb_sm_home_settings_public()),
    ]);

    register_rest_route('ybb/v1', '/hot-products', [
        'methods' => 'GET',
        'permission_callback' => $public,
        'callback' => static fn () => rest_ensure_response(ybb_sm_hot_products_public()),
    ]);

    register_rest_route('ybb/v1', '/latest-stories', [
        'methods' => 'GET',
        'permission_callback' => $public,
        'callback' => static fn () => rest_ensure_response(ybb_sm_latest_stories_public()),
    ]);

    register_rest_route('ybb/v1', '/site-brand', [
        'methods' => 'GET',
        'permission_callback' => $public,
        'callback' => static fn () => rest_ensure_response(ybb_sm_brand_get()),
    ]);

    register_rest_route('ybb/v1', '/site-manager/audit-log', [
        'methods' => 'GET',
        'permission_callback' => static fn () => current_user_can('manage_options'),
        'callback' => static function (WP_REST_Request $request) {
            return rest_ensure_response(ybb_sm_audit_public_list([
                'category' => $request->get_param('category') ?? 'all',
                'status' => $request->get_param('status') ?? 'all',
                'days' => (int) ($request->get_param('days') ?? 30),
                'page' => (int) ($request->get_param('page') ?? 1),
                'per_page' => (int) ($request->get_param('per_page') ?? 50),
            ]));
        },
    ]);

    register_rest_route('ybb/v1', '/deploy/step', [
        'methods' => 'POST',
        'permission_callback' => 'ybb_sm_deploy_verify_key',
        'callback' => static function (WP_REST_Request $request) {
            $step = sanitize_key($request->get_param('step') ?? '');
            $label = sanitize_text_field($request->get_param('label') ?? '');
            $deploy = ybb_sm_deploy_get();
            if (($deploy['state'] ?? 'idle') !== 'running') {
                ybb_sm_deploy_save([
                    'state' => 'running',
                    'startedAt' => gmdate('c'),
                    'lastError' => '',
                ]);
            }
            ybb_sm_deploy_save([
                'currentStep' => $step !== '' ? $step : sanitize_key($request->get_param('step') ?? ''),
                'currentStepLabel' => $label,
                'currentStepAt' => gmdate('c'),
            ]);
            if ($label === '' && $step !== '') {
                $stepLabels = [
                    'sync' => '正在�?WooCommerce 同步产品数据�?,
                    'build' => '正在构建静态站�?,
                    'audit' => '正在审计部署包�?,
                    'upload' => '正在上传静态文件�?,
                    'browser' => '等待浏览器解压上传（若遇 Captcha 需人工）�?,
                ];
                $label = $stepLabels[$step] ?? ('部署步骤�? . $step);
            }
            if ($label !== '' && function_exists('ybb_sm_audit_log_deploy_event')) {
                ybb_sm_audit_log_deploy_event('deploy_step', 'running', $label, ['step' => $step]);
            }

            return rest_ensure_response(['ok' => true]);
        },
    ]);

    register_rest_route('ybb/v1', '/deploy/status', [
        'methods' => 'GET',
        'permission_callback' => static function (WP_REST_Request $request) {
            if ($request->get_param('pending') && ybb_sm_deploy_verify_key($request)) {
                return true;
            }

            return current_user_can('manage_options') || ybb_sm_deploy_verify_key($request);
        },
        'callback' => static function (WP_REST_Request $request) {
            $check = (bool) $request->get_param('pending');

            return rest_ensure_response(ybb_sm_deploy_status_public($check));
        },
    ]);

    register_rest_route('ybb/v1', '/deploy/trigger', [
        'methods' => 'POST',
        'permission_callback' => static function (WP_REST_Request $request) {
            return current_user_can('manage_options') || ybb_sm_deploy_verify_key($request);
        },
        'callback' => static function (WP_REST_Request $request) {
            $trigger = sanitize_key($request->get_param('reason') ?? 'manual');
            ybb_sm_deploy_queue($trigger !== '' ? $trigger : 'manual');

            return rest_ensure_response(['queued' => true, 'state' => 'pending']);
        },
    ]);

    register_rest_route('ybb/v1', '/deploy/claim', [
        'methods' => 'POST',
        'permission_callback' => 'ybb_sm_deploy_verify_key',
        'callback' => static function () {
            $claimed = ybb_sm_deploy_claim();

            return rest_ensure_response(['claimed' => $claimed]);
        },
    ]);

    register_rest_route('ybb/v1', '/deploy/complete', [
        'methods' => 'POST',
        'permission_callback' => 'ybb_sm_deploy_verify_key',
        'callback' => static function (WP_REST_Request $request) {
            $state = sanitize_key($request->get_param('state') ?? 'success');
            if (!in_array($state, ['success', 'failed', 'idle'], true)) {
                $state = 'failed';
            }
            $buildId = sanitize_text_field($request->get_param('buildId') ?? '');
            $error = sanitize_text_field($request->get_param('error') ?? '');
            ybb_sm_deploy_complete($state, $buildId, $error);
            if ($state === 'success' && $buildId !== '' && function_exists('ybb_sm_product_update_index_meta')) {
                $count = (int) ($request->get_param('productCount') ?? 0);
                if ($count <= 0 && function_exists('wc_get_products')) {
                    $ids = wc_get_products([
                        'status' => 'publish',
                        'limit' => -1,
                        'return' => 'ids',
                    ]);
                    $count = is_array($ids) ? count($ids) : 0;
                }
                $handles = $request->get_param('productHandles');
                if (!is_array($handles)) {
                    $handles = [];
                }
                ybb_sm_product_update_index_meta($buildId, $count, $handles);
            }
            if (function_exists('ybb_sm_audit_log_deploy_event')) {
                if ($state === 'success') {
                    $summary = $buildId !== ''
                        ? '站点已更新，buildId ' . $buildId
                        : '站点部署已完�?;
                    ybb_sm_audit_log_deploy_event(
                        'deploy_success',
                        'success',
                        $summary,
                        ['buildId' => $buildId],
                        $buildId !== '' ? '生产 index.html buildId=' . $buildId : ''
                    );
                } elseif ($state === 'failed') {
                    $friendly = ybb_sm_audit_friendly_error($error);
                    ybb_sm_audit_log_deploy_event(
                        'deploy_failed',
                        'failed',
                        '部署失败�? . $friendly,
                        [],
                        $error
                    );
                }
            }

            return rest_ensure_response(['ok' => true, 'state' => $state]);
        },
    ]);
});
