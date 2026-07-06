<?php
/**
 * Upsert shipping / privacy / refund_returns page content (exact copy).
 * Run: https://carp-ybb.com/update-wp-policy-content.php?key=...&nocache=1
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
        'content' => '<h2>1. Processing Time</h2><p>All orders will be processed within 1â€? business days after payment confirmation. Orders are not shipped on weekends and holidays.</p><h2>2. Delivery Time</h2><p>We ship worldwide from China.</p><p>- United Kingdom: 10â€?0 business days</p><p>- United States, Canada, Australia: 12â€?5 business days</p><p>- European Union countries: 12â€?2 business days</p><p>Delivery delays may occur due to customs clearance or logistics exceptions.</p><h2>3. Shipping Cost</h2><p>Standard flat shipping rate applies to all orders. Free shipping offers may be available during promotional activities.</p><h2>4. Customs Duties</h2><p>Buyers are responsible for any import taxes, customs duties or local fees charged by your countryâ€™s customs department.</p><h2>5. Shipping Exceptions</h2><p>We are not liable for lost or damaged packages caused by incorrect address information provided by customers.</p>',
    ],
    'privacy' => [
        'title' => 'Privacy Policy',
        'content' => '<h2>1. Information We Collect</h2><p>We collect personal information you provide when placing orders, including your name, shipping address, email address and phone number. We also automatically collect device and browsing data to improve our service.</p><h2>2. Use of Your Information</h2><p>We use your data to process orders, arrange delivery, send order updates and respond to your support requests. We will never sell or rent your personal information to third parties for marketing purposes.</p><h2>3. Data Security</h2><p>We take reasonable technical measures to protect your personal data from unauthorized access, loss or leakage.</p><h2>4. Cookies</h2><p>This website uses cookies to optimize browsing experience. You may disable cookies in your browser settings at any time.</p><h2>5. Contact Us</h2><p>If you have questions about this privacy policy, please email us via the contact page.</p>',
    ],
    'refund_returns' => [
        'title' => 'Returns & Refund Policy',
        'content' => '<h2>1. Return Eligibility</h2><p>You may apply for return or exchange within 30 days after receiving your items. Products must be unused, undamaged and kept in original packaging to qualify for return.</p><h2>2. Non-Returnable Items</h2><p>Customized goods, clearance sale items and damaged goods caused by improper personal use cannot be returned.</p><h2>3. Return Shipping Cost</h2><p>If the item has quality defects or shipping errors on our side, we cover return shipping fees. If you return items due to personal preference, you need to bear the return delivery cost.</p><h2>4. Refund Process</h2><p>Once we receive and inspect the returned goods, we will issue your full or partial refund within 5â€? business days to your original payment account.</p><h2>5. Damaged/Lost Goods</h2><p>Please contact our customer service with photos of damaged items within 7 days after delivery. We will arrange re-delivery or full refund for verified defective products.</p>',
    ],
];

$report = ['updated' => [], 'created' => [], 'errors' => []];

foreach ($pages as $slug => $data) {
    $existing = get_page_by_path($slug);
    if ($existing) {
        $id = wp_update_post([
            'ID' => $existing->ID,
            'post_title' => $data['title'],
            'post_content' => $data['content'],
            'post_status' => 'publish',
        ], true);
        if (is_wp_error($id)) {
            $report['errors'][] = ['slug' => $slug, 'message' => $id->get_error_message()];
            continue;
        }
        $report['updated'][] = $slug;
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
