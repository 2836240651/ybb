<?php
require __DIR__ . '/wp-load.php';
header('Content-Type: text/plain; charset=utf-8');
if (($_GET['key'] ?? '') !== 'ybb-migrate-20260624') { http_response_code(403); exit("forbidden\n"); }
global $wpdb;
$tables = ['wc_orders','wc_orders_meta','wc_order_addresses','wc_order_operational_data'];
$deleted = 0;
foreach ($tables as $t) {
    $table = $wpdb->prefix . $t;
    $exists = $wpdb->get_var($wpdb->prepare('SHOW TABLES LIKE %s', $table));
    if ($exists !== $table) continue;
    if ($t === 'wc_orders') {
        $deleted = (int)$wpdb->get_var("SELECT COUNT(*) FROM {$table}");
    }
    $wpdb->query("DELETE FROM {$table}");
}
echo "purged_hpos_orders=$deleted\n";
