<?php
require __DIR__ . '/wp-load.php';
header('Content-Type: application/json; charset=utf-8');
if (($_GET['key'] ?? '') !== 'ybb-migrate-20260624') {
    http_response_code(403);
    exit(json_encode(['error' => 'forbidden']));
}

$out = [
    'productTaxonomies' => get_object_taxonomies('product', 'objects'),
    'categories' => [],
    'brands' => [],
    'tags' => [],
    'attributes' => [],
    'sampleProducts' => [],
];

$terms = get_terms([
    'taxonomy' => 'product_cat',
    'hide_empty' => false,
    'number' => 0,
]);
if (!is_wp_error($terms)) {
    foreach ($terms as $t) {
        $out['categories'][] = [
            'id' => $t->term_id,
            'name' => $t->name,
            'slug' => $t->slug,
            'parent' => $t->parent,
            'count' => $t->count,
        ];
    }
}

if (taxonomy_exists('product_brand')) {
    $brands = get_terms(['taxonomy' => 'product_brand', 'hide_empty' => false, 'number' => 0]);
    if (!is_wp_error($brands)) {
        foreach ($brands as $t) {
            $out['brands'][] = [
                'id' => $t->term_id,
                'name' => $t->name,
                'slug' => $t->slug,
                'count' => $t->count,
            ];
        }
    }
}

$tags = get_terms(['taxonomy' => 'product_tag', 'hide_empty' => false, 'number' => 0]);
if (!is_wp_error($tags)) {
    foreach ($tags as $t) {
        $out['tags'][] = [
            'id' => $t->term_id,
            'name' => $t->name,
            'slug' => $t->slug,
            'count' => $t->count,
        ];
    }
}

if (function_exists('wc_get_attribute_taxonomies')) {
    foreach (wc_get_attribute_taxonomies() as $attr) {
        $tax = wc_attribute_taxonomy_name($attr->attribute_name);
        $terms = get_terms(['taxonomy' => $tax, 'hide_empty' => false, 'number' => 50]);
        $termList = [];
        if (!is_wp_error($terms)) {
            foreach ($terms as $t) {
                $termList[] = ['name' => $t->name, 'slug' => $t->slug, 'count' => $t->count];
            }
        }
        $out['attributes'][] = [
            'id' => (int) $attr->attribute_id,
            'name' => $attr->attribute_label,
            'slug' => $attr->attribute_name,
            'taxonomy' => $tax,
            'type' => $attr->attribute_type,
            'order_by' => $attr->attribute_orderby,
            'termCount' => is_array($terms) ? count($terms) : 0,
            'termsSample' => array_slice($termList, 0, 15),
        ];
    }
}

$products = wc_get_products(['limit' => 5, 'status' => 'publish', 'return' => 'objects']);
foreach ($products as $p) {
    $cats = wp_get_post_terms($p->get_id(), 'product_cat', ['fields' => 'names']);
    $brands = taxonomy_exists('product_brand')
        ? wp_get_post_terms($p->get_id(), 'product_brand', ['fields' => 'names'])
        : [];
    $attrs = [];
    foreach ($p->get_attributes() as $key => $attr) {
        $attrs[$key] = $attr->is_taxonomy() ? $attr->get_options() : $attr->get_options();
    }
    $out['sampleProducts'][] = [
        'id' => $p->get_id(),
        'name' => $p->get_name(),
        'sku' => $p->get_sku(),
        'categories' => is_array($cats) ? $cats : [],
        'brands' => is_array($brands) ? $brands : [],
        'tags' => wp_get_post_terms($p->get_id(), 'product_tag', ['fields' => 'names']),
        'attributes' => $attrs,
    ];
}

// Slim taxonomy objects for JSON
$out['productTaxonomies'] = array_map(function ($tax) {
    return [
        'name' => $tax->name,
        'label' => $tax->label,
        'hierarchical' => (bool) $tax->hierarchical,
        'public' => (bool) $tax->public,
    ];
}, $out['productTaxonomies']);

echo json_encode($out, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
