<?php
/**
 * One-shot: activate Quorlyx + configure Variation A (GRSAI via openai_compatible).
 * DELETE after successful run.
 */
require __DIR__ . '/wp-load.php';

header('Content-Type: application/json; charset=utf-8');

if (($_GET['key'] ?? '') !== 'ybb-migrate-20260624') {
    http_response_code(403);
    echo json_encode(['ok' => false, 'error' => 'forbidden']);
    exit;
}

$config_path = __DIR__ . '/quorlyx-setup-config.json';
$raw         = file_get_contents('php://input');
$body        = json_decode($raw ?: '{}', true);
if (!is_array($body)) {
    $body = [];
}

if (empty($body) && is_readable($config_path)) {
    $body = json_decode((string) file_get_contents($config_path), true);
    if (!is_array($body)) {
        $body = [];
    }
}

$api_key  = sanitize_text_field($body['api_key'] ?? '');
$model    = sanitize_text_field($body['model'] ?? 'gpt-5.5');
$base_url = esc_url_raw(trim((string) ($body['base_url'] ?? '')));
if ($base_url === '') {
	$base_url = 'https://grsaiapi.com/v1';
}
$provider = sanitize_key($body['provider'] ?? 'openai_compatible');
if ($provider === '') {
	$provider = 'openai_compatible';
}

if ($api_key === '' || (($_GET['apply'] ?? '') !== '1' && $_SERVER['REQUEST_METHOD'] !== 'POST')) {
    http_response_code(400);
    echo json_encode([
        'ok'    => false,
        'error' => 'api_key required; call with apply=1 and quorlyx-setup-config.json on server',
    ]);
    exit;
}

require_once ABSPATH . 'wp-admin/includes/plugin.php';

$plugin_file = 'quorlyx/quorlyx.php';
if (!file_exists(WP_PLUGIN_DIR . '/quorlyx/quorlyx.php')) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'plugin_files_missing']);
    exit;
}

$activate = activate_plugin($plugin_file, '', false, true);
if (is_wp_error($activate)) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'activate_failed', 'message' => $activate->get_error_message()]);
    exit;
}

$defaults = function_exists('quorlyx_get_global_defaults')
    ? quorlyx_get_global_defaults()
    : [];

$options = get_option('quorlyx_options', $defaults);
if (!is_array($options)) {
    $options = [];
}
if (function_exists('quorlyx_merge_global_options')) {
    $options = quorlyx_merge_global_options($options);
} elseif (is_array($defaults)) {
    $options = array_replace_recursive($defaults, $options);
}

if (!isset($options['variation_a']) || !is_array($options['variation_a'])) {
    $options['variation_a'] = [];
}

$variation_defaults = function_exists('quorlyx_get_variation_defaults')
    ? quorlyx_get_variation_defaults()
    : [];

$options['variation_a'] = array_replace_recursive($variation_defaults, $options['variation_a']);
$options['variation_a']['chat_enabled'] = true;
$options['variation_a']['ai_provider']  = $provider;
$options['variation_a']['ai_model']     = $model;

if (!isset($options['variation_a']['api_keys']) || !is_array($options['variation_a']['api_keys'])) {
    $options['variation_a']['api_keys'] = [];
}
$options['variation_a']['api_keys'][$provider] = $api_key;

if (!isset($options['variation_a']['api_base_urls']) || !is_array($options['variation_a']['api_base_urls'])) {
    $options['variation_a']['api_base_urls'] = [];
}
$options['variation_a']['api_base_urls'][$provider] = $base_url;

update_option('quorlyx_options', $options);

if (is_readable($config_path)) {
    @unlink($config_path);
}

$active = in_array($plugin_file, (array) get_option('active_plugins', []), true);

echo json_encode([
    'ok'       => true,
    'active'   => $active,
    'provider' => $options['variation_a']['ai_provider'] ?? '',
    'model'    => $options['variation_a']['ai_model'] ?? '',
    'base_url' => $options['variation_a']['api_base_urls'][$provider] ?? '',
    'key_set'  => !empty($options['variation_a']['api_keys'][$provider]),
], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
