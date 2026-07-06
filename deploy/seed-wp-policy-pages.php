<?php
/**
 * Seed missing WooCommerce storefront policy / info pages.
 * Run once: https://carp-ybb.com/seed-wp-policy-pages.php?key=...&nocache=1
 * Delete after use.
 */
require __DIR__ . '/wp-load.php';
header('Content-Type: application/json; charset=utf-8');

$expectedKey = 'ybb-migrate-20260624';
if (($_GET['key'] ?? '') !== $expectedKey) {
    http_response_code(403);
    exit(json_encode(['error' => 'forbidden']));
}

$pages = [
    'shipping' => [
        'title' => 'Shipping Policy',
        'content' => '<h2>Delivery times</h2><p>Standard wholesale orders ship within 1â€? business days after payment confirmation. OEM orders follow the lead time stated on your PO.</p><h2>Shipping methods</h2><p>We ship via express courier or sea freight depending on order size and destination. Tracking is provided for express shipments.</p><h2>International orders</h2><p>Import duties and taxes are the buyer\'s responsibility unless otherwise agreed in writing.</p>',
    ],
    'privacy' => [
        'title' => 'Privacy Policy',
        'content' => '<h2>Information we collect</h2><p>We collect contact details and order information you submit through forms, email, or checkout.</p><h2>How we use data</h2><p>Data is used to process orders, respond to RFQs, and improve our wholesale service. We do not sell personal data to third parties.</p><h2>Contact</h2><p>For privacy requests, use the contact form on this site.</p>',
    ],
    'terms' => [
        'title' => 'Terms & Conditions',
        'content' => '<h2>B2B wholesale terms</h2><p>All prices are ex-works unless otherwise stated. Payment terms: 30% deposit, 70% before shipment unless a credit account is approved.</p><h2>Product specifications</h2><p>Goods are supplied to approved samples and PO confirmations. Claims must be reported within 14 days of receipt with supporting evidence.</p>',
    ],
    'samples' => [
        'title' => 'Sample Policy',
        'content' => '<h2>Try before you scale</h2><p>Samples are charged at catalog sample price plus courier freight. Sample fees may be credited against the first bulk order above the agreed threshold.</p><h2>OEM samples</h2><p>Custom OEM samples may require a tooling deposit; timelines are quoted per project.</p>',
    ],
    'moq-lead-time' => [
        'title' => 'MOQ & Lead Time',
        'content' => '<h2>Minimum order quantities</h2><p>MOQ varies by SKU category â€?standard terminal tackle typically from 500â€?,000 units per SKU. Custom OEM projects are quoted separately.</p><h2>Lead time</h2><p>Standard lead time is 25â€?5 days after artwork approval and deposit. Rush programs are available for repeat orders.</p>',
    ],
];

$report = ['created' => [], 'skipped' => [], 'errors' => []];

foreach ($pages as $slug => $data) {
    $existing = get_page_by_path($slug);
    if ($existing) {
        $report['skipped'][] = $slug;
        continue;
    }
    $id = wp_insert_post([
        'post_title' => $data['title'],
        'post_name' => $slug,
        'post_content' => $data['content'],
        'post_status' => 'publish',
        'post_type' => 'page',
    ], true);
    if (is_wp_error($id)) {
        $report['errors'][] = ['slug' => $slug, 'message' => $id->get_error_message()];
        continue;
    }
    $report['created'][] = $slug;
}

echo json_encode($report, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
