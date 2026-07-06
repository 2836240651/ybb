<?php
require __DIR__ . '/wp-load.php';
header('Content-Type: text/plain; charset=utf-8');
if (($_GET['key'] ?? '') !== 'ybb-migrate-20260624') { http_response_code(403); exit("forbidden\n"); }
global $wpdb;
$wc = function_exists('wc_get_orders') ? count(wc_get_orders(['limit'=>-1,'return'=>'ids','status'=>'any'])) : -1;
$posts = count(get_posts(['post_type'=>'shop_order','post_status'=>'any','numberposts'=>-1,'fields'=>'ids']));
$table = $wpdb->prefix . 'wc_orders';
$hpos = (int)$wpdb->get_var("SELECT COUNT(*) FROM {$table}");
echo "wc_get_orders=$wc posts=$posts hpos=$hpos\n";
