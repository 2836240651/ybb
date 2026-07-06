<?php
require __DIR__ . '/wp-load.php';
header('Content-Type: application/json; charset=utf-8');
if (($_GET['key'] ?? '') !== 'ybb-migrate-20260624') exit('{}');
$files = ['wc-list-plugins.php', 'wc-chat-snippet-audit.php', 'wc-cleanup-migration.php'];
$removed = [];
foreach ($files as $f) {
    $p = __DIR__ . '/' . $f;
    if (is_file($p) && @unlink($p)) $removed[] = $f;
}
echo json_encode(['removed' => $removed]);
