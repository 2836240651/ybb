<?php
/** List WP plugins; highlight chat-related. Delete after use. */
require __DIR__ . '/wp-load.php';
header('Content-Type: application/json; charset=utf-8');
if (($_GET['key'] ?? '') !== 'ybb-migrate-20260624') {
    http_response_code(403);
    exit('{}');
}

if (!function_exists('get_plugins')) {
    require_once ABSPATH . 'wp-admin/includes/plugin.php';
}

$all = get_plugins();
$active = get_option('active_plugins', []);
$chatPattern = '/chat|tidio|crisp|tawk|livechat|zendesk|gorgias|intercom|hubspot|whatsapp|messenger|chatway|chaty|smartsupp|drift|olark|freshchat|live.?chat|wp-live-chat/i';

$plugins = [];
$chatHits = [];

foreach ($all as $file => $meta) {
    $row = [
        'file' => $file,
        'name' => $meta['Name'] ?? '',
        'version' => $meta['Version'] ?? '',
        'active' => in_array($file, $active, true),
    ];
    $plugins[] = $row;
    $hay = ($row['name'] . ' ' . $file);
    if (preg_match($chatPattern, $hay)) {
        $chatHits[] = $row;
    }
}

// Must-use plugins
$mu = [];
$muDir = WPMU_PLUGIN_DIR;
if (is_dir($muDir)) {
    foreach (glob($muDir . '/*.php') ?: [] as $php) {
        $mu[] = basename($php);
    }
}

echo json_encode([
    'site' => home_url(),
    'activeCount' => count(array_filter($plugins, fn($p) => $p['active'])),
    'totalCount' => count($plugins),
    'chatRelated' => $chatHits,
    'activePlugins' => array_values(array_filter($plugins, fn($p) => $p['active'])),
    'mustUse' => $mu,
], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
