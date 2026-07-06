<?php
/**
 * Upsert OEM / ODM pages with per-page copy (matches Next.js static frontend).
 * Run once: https://carp-ybb.com/update-wp-oem-pages.php?key=ybb-migrate-20260626&nocache=1
 * Delete this file from public_html after success.
 */
require __DIR__ . '/wp-load.php';
header('Content-Type: application/json; charset=utf-8');

$expectedKey = 'ybb-migrate-20260626';
if (($_GET['key'] ?? '') !== $expectedKey) {
    http_response_code(403);
    exit(json_encode(['error' => 'forbidden']));
}

$center = 'text-align:center;max-width:48rem;margin:0 auto;';
$p = 'margin:0 0 1rem;line-height:1.7;';
$h1 = 'font-size:2.25rem;font-weight:700;margin-bottom:2rem;';
$h2 = 'font-size:1.5rem;font-weight:700;margin:2rem 0 1rem;';
$ol = 'text-align:left;display:inline-block;margin:0 auto;padding-left:1.25rem;';

$overview = <<<HTML
<div style="{$center}">
<h1 style="{$h1}">OEM &amp; ODM Custom Service Overview</h1>
<h2 style="{$h2}">ODM Private Label Service</h2>
<p style="{$p}">We specialize in carp fishing tackle manufacturing with a full library of self-developed molds, covering sinkers, bait cages, fishing platforms and ready rigs.</p>
<p style="{$p}">No extra mold cost for ODM cooperation. We can print your brand logo, adjust product colors and weights on our existing stock items, matched with fully customized packages for instant sales.</p>
<p style="{$p}"><strong>Key Benefits:</strong> Low MOQ, zero mold fee, short lead time. Ideal for new tackle brands, small cross-border vendors and local fishing retail shops.</p>
<h2 style="{$h2}">OEM Custom Mold Manufacturing</h2>
<p style="{$p}">If you hold exclusive design drawings, 3D files or original product ideas, we offer full-cycle OEM development.</p>
<p style="{$p}">Our engineering team handles mold opening, prototype testing and mass production. Material, size, structure and appearance can be fully customized as requested. Dedicated production lines protect your design intellectual property exclusively.</p>
<p style="{$p}"><strong>Key Benefits:</strong> Unique differentiated tackle only for your brand. Perfect for mature fishing brands with independent R&amp;D teams targeting Europe, US and Canada.</p>
<h2 style="{$h2}">All-In-One Custom Advantages</h2>
<ol style="{$ol}">
<li>Full-range tackle customization, mixed orders of custom goods &amp; stock items supported;</li>
<li>Free packaging graphic design, integrated branding for products &amp; packages;</li>
<li>Strict full-process QC, compliant with offline retail &amp; cross-border e-commerce standards in Western markets;</li>
<li>Tiered stable pricing for long-term partners to maximize your profit margin;</li>
<li>Rich experience cooperating with global tackle brands, familiar with compliance rules of EU, UK and Canada markets.</li>
</ol>
</div>
HTML;

$privateLabel = <<<HTML
<div style="{$center}">
<h1 style="{$h1}">Private Label</h1>
<p style="{$p}">We provide full private label ODM service based on our 10,000+ ready carp fishing tackle molds.</p>
<p style="{$p}">No new mold cost required. We can print your exclusive brand logo on our stock sinkers, bait cages, ready rigs and customize product colors &amp; surface finishes.</p>
<p style="{$p}">Low MOQ &amp; fast lead time help cross-border sellers and offline fishing stores build their own tackle brands and expand markets in Europe, US and Canada rapidly.</p>
</div>
HTML;

$customPackaging = <<<HTML
<div style="{$center}">
<h1 style="{$h1}">Custom Packaging</h1>
<p style="{$p}">One-stop custom packaging solution with FREE graphic design support.</p>
<p style="{$p}">Custom color boxes, product labels, poly bags and shipping cartons are available for both private label ODM and custom OEM orders.</p>
<p style="{$p}">All package sizes, printing artwork and brand texts can be adjusted to fit your local market, boosting shelf recognition and brand image.</p>
</div>
HTML;

$moqLeadTime = <<<HTML
<div style="{$center}">
<h1 style="{$h1}">MOQ &amp; Lead Time</h1>
<ol style="{$ol}">
<li>ODM Private Label: Low MOQ for our in-stock items. Minimum 3,000pcs for sinkers/bait cages &amp; 500 sets for fishing rigs. Goods will be delivered within 7�?5 days after logo &amp; packaging confirmation.</li>
<li>OEM Custom Mold: MOQ negotiable based on product craft. Total lead time including prototype &amp; new mold development is 30�?0 days. Split shipment is acceptable for bulk orders.</li>
<li>Peak Season Support: Our standardized production line guarantees stable daily output, supporting seasonal stock orders for overseas brands with on-time delivery.</li>
</ol>
</div>
HTML;

$pages = [
    'oem-odm' => [
        'title' => 'OEM / ODM Services',
        'content' => $overview,
    ],
    'private-label' => [
        'title' => 'Private Label',
        'content' => $privateLabel,
    ],
    'custom-packaging' => [
        'title' => 'Custom Packaging',
        'content' => $customPackaging,
    ],
    'moq-lead-time' => [
        'title' => 'MOQ & Lead Time',
        'content' => $moqLeadTime,
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
