<?php
/**
 * One-shot: enable wholesale collections carousel in YBB Home Settings.
 * Delete after use. Key: ybb-migrate-20260624
 */
$key = $_GET['key'] ?? '';
if ($key !== 'ybb-migrate-20260624') {
    http_response_code(403);
    exit('forbidden');
}

require_once __DIR__ . '/wp-load.php';

$option = 'ybb_home_settings';
$current = get_option($option, []);
if (!is_array($current)) {
    $current = [];
}
$current['wholesaleCollectionsEnabled'] = true;
update_option($option, $current);

header('Content-Type: application/json; charset=utf-8');
echo json_encode([
    'ok' => true,
    'wholesaleCollectionsEnabled' => true,
    'option' => get_option($option),
], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
