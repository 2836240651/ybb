<?php
/**
 * Woo + Airwallex health probe. ?key=ybb-migrate-20260624
 */
require __DIR__ . '/wp-load.php';
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

if (($_GET['key'] ?? '') !== 'ybb-migrate-20260624') {
    http_response_code(403);
    echo json_encode(['error' => 'forbidden']);
    exit;
}

$out = [
    'site' => home_url(),
    'woocommerceActive' => class_exists('WooCommerce'),
    'wcVersion' => defined('WC_VERSION') ? WC_VERSION : null,
];

if (!class_exists('WooCommerce')) {
    echo json_encode($out, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    exit;
}

$gateways = WC()->payment_gateways();
$available = $gateways ? $gateways->get_available_payment_gateways() : [];
$all = $gateways ? $gateways->payment_gateways() : [];

$gwList = [];
foreach ($all as $id => $gw) {
    $gwList[$id] = [
        'title' => $gw->get_title(),
        'enabled' => $gw->enabled === 'yes',
        'available' => isset($available[$id]),
        'class' => get_class($gw),
    ];
}

$out['paymentGateways'] = $gwList;
$out['airwallex'] = [
    'pluginActive' => is_plugin_active('airwallex-online-payments-gateway/airwallex-online-payments-gateway.php'),
    'gatewayIds' => array_values(array_filter(array_keys($gwList), static fn($id) => str_contains($id, 'airwallex'))),
    'enabledGateways' => array_values(array_filter($gwList, static fn($g) => $g['enabled'] && str_contains($g['class'], 'Airwallex'))),
];

$out['storeApi'] = [
    'restUrl' => rest_url('wc/store/v1/products'),
];

$out['guestCheckout'] = get_option('woocommerce_enable_guest_checkout', 'no');
$out['checkoutLoginReminder'] = get_option('woocommerce_enable_checkout_login_reminder', 'no');

echo json_encode($out, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
