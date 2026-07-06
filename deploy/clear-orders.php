<?php
// One-time: permanently delete all WooCommerce orders. Delete after use.
require __DIR__ . '/wp-load.php';
header('Content-Type: text/plain; charset=utf-8');
$expected = 'ybb-migrate-20260624';
if (($_GET['key'] ?? '') !== $expected) {
    http_response_code(403);
    echo "forbidden\n";
    exit(1);
}

$count = 0;
if (function_exists('wc_get_orders')) {
    $ids = wc_get_orders([
        'limit' => -1,
        'return' => 'ids',
        'status' => 'any',
        'type' => 'shop_order',
    ]);
    foreach ($ids as $id) {
        $order = wc_get_order($id);
        if ($order) {
            $order->delete(true);
            $count++;
        }
    }
}

if ($count === 0) {
    $posts = get_posts([
        'post_type' => 'shop_order',
        'post_status' => 'any',
        'numberposts' => -1,
        'fields' => 'ids',
    ]);
    foreach ($posts as $id) {
        wp_delete_post($id, true);
        $count++;
    }
}

if ($count === 0) {
    global $wpdb;
    $table = $wpdb->prefix . 'wc_orders';
    $ids = $wpdb->get_col("SELECT id FROM {$table}");
    foreach ($ids as $id) {
        $order = wc_get_order((int)$id);
        if ($order) {
            $order->delete(true);
            $count++;
            continue;
        }
        $wpdb->delete($table, ['id' => (int)$id]);
        $meta = $wpdb->prefix . 'wc_orders_meta';
        $wpdb->delete($meta, ['order_id' => (int)$id]);
        $count++;
    }
}

echo "deleted_orders=$count\n";
