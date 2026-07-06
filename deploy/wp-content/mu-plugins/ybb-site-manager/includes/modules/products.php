<?php

if (!defined('ABSPATH')) {
    exit;
}

const YBB_SM_PRODUCT_OVERRIDES_OPTION = 'ybb_sm_product_overrides';

function ybb_sm_products_defaults(): array
{
    return [
        'enabled' => true,
        'overrides' => [],
        'pdp' => ybb_sm_pdp_defaults(),
        'productIndex' => [
            'lastBuiltAt' => '',
            'lastBuildId' => '',
            'productCount' => 0,
        ],
    ];
}

function ybb_sm_products_module(): array
{
    $data = ybb_sm_get_module('products');
    if (!is_array($data) || $data === []) {
        $data = ybb_sm_products_defaults();
    } else {
        $data = array_replace(ybb_sm_products_defaults(), $data);
    }

    $data['overrides'] = ybb_sm_product_overrides_all();

    return $data;
}

/** @return array<string, array<string, mixed>> */
function ybb_sm_product_overrides_all(): array
{
    $stored = get_option(YBB_SM_PRODUCT_OVERRIDES_OPTION, null);
    if (is_array($stored) && count($stored) > 0) {
        return $stored;
    }

    $legacy = ybb_sm_get_module('products');
    $legacyOverrides = is_array($legacy['overrides'] ?? null) ? $legacy['overrides'] : [];
    if ($legacyOverrides !== []) {
        ybb_sm_product_overrides_save($legacyOverrides);

        return $legacyOverrides;
    }

    return [];
}

/** @param array<string, array<string, mixed>> $overrides */
function ybb_sm_product_overrides_save(array $overrides): bool
{
    return update_option(YBB_SM_PRODUCT_OVERRIDES_OPTION, $overrides, false);
}

function ybb_sm_product_handle_from_sku(string $sku): string
{
    return sanitize_title(strtolower(trim($sku)));
}

function ybb_sm_product_override_get(string $handle): array
{
    $handle = sanitize_title($handle);
    if ($handle === '') {
        return ybb_sm_product_override_defaults();
    }

    $module = ybb_sm_products_module();
    $row = $module['overrides'][$handle] ?? [];

    return ybb_sm_product_override_normalize($row);
}

/** @return array<string, mixed> */
function ybb_sm_product_override_defaults(): array
{
    return [
        'titleZh' => '',
        'titleJa' => '',
        'frontHidden' => false,
        'descriptionZh' => '',
        'descriptionJa' => '',
        'hideDescription' => false,
        'hideAdditionalInfo' => false,
        'galleryEnabled' => true,
        'galleryOverrideEnabled' => false,
        'galleryDefaultIndex' => 0,
        'galleryImages' => [],
        'galleryHideIndexes' => [],
    ];
}

/** @param array<string, mixed> $row */
function ybb_sm_product_override_normalize(array $row): array
{
    $galleryImages = $row['galleryImages'] ?? [];
    if (is_string($galleryImages)) {
        $galleryImages = preg_split('/[\r\n]+/', $galleryImages) ?: [];
    }
    if (!is_array($galleryImages)) {
        $galleryImages = [];
    }
    $galleryImages = array_values(array_filter(array_map(
        static fn ($url) => is_string($url) ? trim($url) : '',
        $galleryImages
    )));

    $galleryHideIndexes = $row['galleryHideIndexes'] ?? [];
    if (is_string($galleryHideIndexes)) {
        $galleryHideIndexes = preg_split('/[,\s]+/', $galleryHideIndexes) ?: [];
    }
    if (!is_array($galleryHideIndexes)) {
        $galleryHideIndexes = [];
    }
    $galleryHideIndexes = array_values(array_unique(array_filter(array_map(
        static fn ($v) => max(0, (int) $v),
        $galleryHideIndexes
    ), static fn ($v) => $v >= 0)));

    return [
        'titleZh' => (string) ($row['titleZh'] ?? ''),
        'titleJa' => (string) ($row['titleJa'] ?? ''),
        'frontHidden' => !empty($row['frontHidden']),
        'descriptionZh' => (string) ($row['descriptionZh'] ?? ''),
        'descriptionJa' => (string) ($row['descriptionJa'] ?? ''),
        'hideDescription' => !empty($row['hideDescription']),
        'hideAdditionalInfo' => !empty($row['hideAdditionalInfo']),
        'galleryEnabled' => array_key_exists('galleryEnabled', $row)
            ? !empty($row['galleryEnabled'])
            : true,
        'galleryOverrideEnabled' => !empty($row['galleryOverrideEnabled']),
        'galleryDefaultIndex' => max(0, (int) ($row['galleryDefaultIndex'] ?? 0)),
        'galleryImages' => $galleryImages,
        'galleryHideIndexes' => $galleryHideIndexes,
    ];
}

/** @return array<int, array<string, mixed>> */
function ybb_sm_product_additional_rows(WC_Product $product): array
{
    $rows = [];
    $weight = $product->get_weight();
    if ($weight !== '' && (float) $weight > 0) {
        $rows[] = [
            'key' => 'weight',
            'label' => __('Weight', 'ybb-site-manager'),
            'value' => function_exists('wc_format_weight')
                ? wc_format_weight((float) $weight)
                : (string) $weight,
            'href' => null,
        ];
    }

    foreach ($product->get_attributes() as $attribute) {
        if (!$attribute->get_visible()) {
            continue;
        }

        $name = $attribute->get_name();
        $label = wc_attribute_label($name, $product);
        if ($attribute->is_taxonomy()) {
            $terms = wc_get_product_terms($product->get_id(), $name, ['fields' => 'all']);
            $names = [];
            $termSlug = '';
            foreach ($terms as $term) {
                if ($term instanceof WP_Term) {
                    $names[] = $term->name;
                    if ($termSlug === '') {
                        $termSlug = $term->slug;
                    }
                }
            }
            $value = implode(', ', $names);
            if ($value === '') {
                continue;
            }
            $rows[] = [
                'key' => (string) $name,
                'label' => (string) $label,
                'value' => $value,
                'href' => null,
                'taxonomy' => (string) $name,
                'termSlug' => $termSlug,
            ];
        } else {
            $options = $attribute->get_options();
            $value = is_array($options) ? implode(', ', array_map('strval', $options)) : (string) $options;
            if ($value === '') {
                continue;
            }
            $rows[] = [
                'key' => sanitize_title((string) $name),
                'label' => (string) $label,
                'value' => $value,
                'href' => null,
            ];
        }
    }

    return $rows;
}

/**
 * Whether description HTML already contains block-level tags.
 */
function ybb_sm_description_has_block_tags(string $html): bool
{
    return (bool) preg_match('/<(p|ul|ol|h[1-6]|hr|div|table|blockquote)\b/i', $html);
}

/**
 * Remove paste cruft from external editors (Grammarly, etc.).
 */
function ybb_sm_strip_description_paste_attrs(string $html): string
{
    $html = preg_replace('/\s+data-start="[^"]*"/i', '', $html);
    $html = preg_replace('/\s+data-end="[^"]*"/i', '', $html);
    $html = preg_replace('/\s+data-section-id="[^"]*"/i', '', $html);
    $html = preg_replace('/\s+class="[^"]*selectionAnchor[^"]*"/i', '', $html);

    return $html;
}

/**
 * Strip leading bullet glyph from a description line.
 */
function ybb_sm_strip_description_bullet_prefix(string $line): string
{
    return trim((string) preg_replace('/^[•·\*\-\?？・]\s*/u', '', trim($line)));
}

/**
 * Whether a line is a bullet list item.
 */
function ybb_sm_is_description_bullet_line(string $line): bool
{
    return (bool) preg_match('/^[•·\*\-\?？・]\s*/u', trim($line));
}

/**
 * Detect section headings (Key Features / 核心亮点 / 主な特徴, etc.).
 */
function ybb_sm_match_description_heading(string $line): ?string
{
    $stripped = ybb_sm_strip_description_bullet_prefix($line);
    if ($stripped === '') {
        return null;
    }

    $exact = [
        'key features' => 'Key Features',
        'conclusion' => 'Conclusion',
        '核心亮点' => '核心亮点',
        '主要特点' => '主要特点',
        '关键特点' => '关键特点',
        '总结' => '总结',
        '结论' => '结论',
        '主な特徴' => '主な特徴',
        '主要な特�? => '主要な特�?,
        'まと�? => 'まと�?,
        '結論' => '結論',
        '総括' => '総括',
    ];

    $lower = mb_strtolower($stripped);
    foreach ($exact as $key => $label) {
        if ($lower === mb_strtolower($key)) {
            return $label;
        }
    }

    if (mb_strlen($stripped) <= 28 && preg_match(
        '/^(key features|conclusion|核心|主要|关键|总结|结论|主な|特徴|まとめ|結論|総括)/ui',
        $stripped
    )) {
        return $stripped;
    }

    return null;
}

/**
 * Flatten mixed HTML / plain text into logical lines for restructuring.
 *
 * @return list<string>
 */
function ybb_sm_description_html_to_lines(string $html): array
{
    $html = ybb_sm_strip_description_paste_attrs($html);
    $text = preg_replace('/<br\s*\/?>/i', "\n", $html);
    $text = preg_replace('/<\/p>\s*<p[^>]*>/i', "\n", $text);
    $text = preg_replace('/<h[1-6][^>]*>(.*?)<\/h[1-6]>/is', "\n$1\n", $text);
    $text = preg_replace('/<hr\s*\/?>/i', "\n", $text);
    $text = preg_replace('/<li[^>]*>(.*?)<\/li>/is', "�?$1\n", $text);
    $text = wp_strip_all_tags((string) $text);
    $text = html_entity_decode($text, ENT_QUOTES | ENT_HTML5, 'UTF-8');
    $text = str_replace(["\r\n", "\r"], "\n", $text);

    $lines = [];
    foreach (explode("\n", $text) as $line) {
        $line = trim($line);
        if ($line !== '') {
            $lines[] = $line;
        }
    }

    return $lines;
}

/**
 * Build structured PDP description HTML (p / h2 / hr / ul) from lines.
 */
function ybb_sm_lines_to_structured_description_html(array $lines): string
{
    $out = [];
    $i = 0;
    $n = count($lines);

    while ($i < $n) {
        $line = (string) $lines[$i];

        $heading = ybb_sm_match_description_heading($line);
        if ($heading !== null) {
            if ($out !== []) {
                $out[] = '<hr />';
            }
            $out[] = '<h2>' . esc_html($heading) . '</h2>';
            $i++;
            continue;
        }

        if (ybb_sm_is_description_bullet_line($line)) {
            $items = [];
            while ($i < $n && ybb_sm_is_description_bullet_line((string) $lines[$i])) {
                $items[] = '<li>' . esc_html(ybb_sm_strip_description_bullet_prefix((string) $lines[$i])) . '</li>';
                $i++;
            }
            $out[] = '<ul>' . implode('', $items) . '</ul>';
            continue;
        }

        $out[] = '<p>' . esc_html($line) . '</p>';
        $i++;
    }

    return implode("\n", $out);
}

/**
 * Align en/zh/ja description structure: headings, horizontal rules, bullet lists.
 */
function ybb_sm_structure_description_html(string $html): string
{
    $html = trim($html);
    if ($html === '') {
        return '';
    }

    $lines = ybb_sm_description_html_to_lines($html);
    if ($lines === []) {
        return '';
    }

    return ybb_sm_lines_to_structured_description_html($lines);
}

/**
 * Convert plain text to HTML; honors manual single-line breaks and blank lines.
 */
function ybb_sm_plain_text_to_description_html(string $text): string
{
    $text = str_replace(["\r\n", "\r"], "\n", trim($text));
    if ($text === '') {
        return '';
    }

    if (strpos($text, "\n\n") !== false) {
        $text = wp_strip_all_tags((string) wpautop($text));
        $text = str_replace(["\r\n", "\r"], "\n", $text);
    }

    $lines = [];
    foreach (explode("\n", $text) as $line) {
        $line = trim($line);
        if ($line !== '') {
            $lines[] = $line;
        }
    }

    if ($lines === []) {
        return '';
    }

    return ybb_sm_lines_to_structured_description_html($lines);
}

/**
 * Normalize newlines inside paragraphs and empty paragraphs (blank lines).
 */
function ybb_sm_normalize_html_description_newlines(string $html): string
{
    $html = preg_replace_callback(
        '/<p([^>]*)>(.*?)<\/p>/is',
        static function (array $m): string {
            $attrs = $m[1];
            $inner = $m[2];
            if (!preg_match('/\r|\n/', $inner)) {
                return $m[0];
            }
            if (preg_match('/<(ul|ol|table|div|blockquote)\b/i', $inner)) {
                return $m[0];
            }
            $inner = preg_replace("/\r\n|\r|\n/", '<br />', $inner);

            return '<p' . $attrs . '>' . $inner . '</p>';
        },
        $html
    );

    return (string) preg_replace(
        '/<p([^>]*)>(?:\s|&nbsp;|<br\s*\/?>)*<\/p>/i',
        '<p class="ybb-desc-spacer">&nbsp;</p>',
        $html
    );
}

/**
 * Sanitize product description HTML; plain text and manual line breaks become proper blocks.
 */
function ybb_sm_prepare_description_html(string $raw): string
{
    $raw = trim($raw);
    if ($raw === '') {
        return '';
    }

    if (wp_strip_all_tags($raw) === $raw) {
        $html = ybb_sm_plain_text_to_description_html($raw);
    } else {
        $html = wp_kses_post($raw);
        $html = ybb_sm_strip_description_paste_attrs($html);

        if (!ybb_sm_description_has_block_tags($html)) {
            $text = preg_replace('/<br\s*\/?>/i', "\n", $html);
            $html = ybb_sm_plain_text_to_description_html((string) wp_strip_all_tags($text));
        } else {
            $html = ybb_sm_structure_description_html($html);
        }
    }

    return wp_kses_post($html);
}

/** @return array{visible:bool,html:array{en:string,zh:string,ja:string}} */
function ybb_sm_product_description_payload(WC_Product $product, array $override): array
{
    $en = ybb_sm_prepare_description_html((string) $product->get_description());
    $zh = trim((string) ($override['descriptionZh'] ?? ''));
    $ja = trim((string) ($override['descriptionJa'] ?? ''));
    $html = [
        'en' => $en,
        'zh' => $zh !== '' ? ybb_sm_prepare_description_html($zh) : $en,
        'ja' => $ja !== '' ? ybb_sm_prepare_description_html($ja) : $en,
    ];
    $visible = empty($override['hideDescription']);
    if ($visible) {
        $visible = false;
        foreach ($html as $part) {
            if (wp_strip_all_tags((string) $part) !== '') {
                $visible = true;
                break;
            }
        }
    }

    return [
        'visible' => $visible,
        'html' => $html,
    ];
}

/** @return array{visible:bool,rows:array<int,array<string,mixed>>} */
function ybb_sm_product_additional_info_payload(WC_Product $product, array $override): array
{
    $rows = ybb_sm_product_additional_rows($product);
    $visible = empty($override['hideAdditionalInfo']) && $rows !== [];

    return [
        'visible' => $visible,
        'rows' => $visible ? $rows : [],
    ];
}

/** @return array{enabled:bool,layout:string,defaultIndex:int,images:array<int,string>,hideIndexes:array<int,int>,wooImages:array<int,string>,overrideImages:array<int,string>,source:string} */
function ybb_sm_product_gallery_payload(WC_Product $product, array $override): array
{
    $baseImages = ybb_sm_product_images_from_wc($product);
    $override = ybb_sm_product_override_normalize($override);
    $overrideImages = $override['galleryImages'];
    $usingOverride = !empty($override['galleryOverrideEnabled']) && $overrideImages !== [];

    $images = $usingOverride ? $overrideImages : $baseImages;

    $hideIndexes = $usingOverride ? $override['galleryHideIndexes'] : [];
    if ($hideIndexes !== []) {
        $hidden = array_fill_keys($hideIndexes, true);
        $images = array_values(array_filter(
            $images,
            static fn ($url, $idx) => !isset($hidden[$idx]),
            ARRAY_FILTER_USE_BOTH
        ));
    }

    $defaultIndex = $usingOverride
        ? max(0, (int) $override['galleryDefaultIndex'])
        : 0;
    if ($defaultIndex < 0 || $defaultIndex >= count($images)) {
        $defaultIndex = 0;
    }

    $enabled = $override['galleryEnabled'];
    if ($images === []) {
        $enabled = false;
    }

    return [
        'enabled' => (bool) $enabled,
        'layout' => 'bottom-strip',
        'defaultIndex' => $defaultIndex,
        'images' => $images,
        'hideIndexes' => $hideIndexes,
        'wooImages' => $baseImages,
        'overrideImages' => $usingOverride ? $overrideImages : [],
        'source' => $usingOverride ? 'override' : 'woo',
    ];
}

/** @return list<string> */
function ybb_sm_product_images_from_wc(WC_Product $product): array
{
    $urls = [];
    $featured_id = (int) $product->get_image_id();
    if ($featured_id > 0) {
        $url = wp_get_attachment_image_url($featured_id, 'full');
        if (is_string($url) && $url !== '') {
            $urls[] = $url;
        }
    }

    foreach ($product->get_gallery_image_ids() as $gallery_id) {
        $gallery_id = (int) $gallery_id;
        if ($gallery_id <= 0) {
            continue;
        }
        $url = wp_get_attachment_image_url($gallery_id, 'full');
        if (is_string($url) && $url !== '' && !in_array($url, $urls, true)) {
            $urls[] = $url;
        }
    }

    return $urls;
}

function ybb_sm_product_find_wc(string $handle): ?WC_Product
{
    if (function_exists('ybb_home_wc_find_product_by_handle')) {
        $product = ybb_home_wc_find_product_by_handle($handle);
        if ($product instanceof WC_Product) {
            return $product;
        }
    }

    if (!function_exists('wc_get_products')) {
        return null;
    }

    $sku = strtoupper(str_replace(' ', '-', $handle));
    $ids = wc_get_products([
        'status' => ['publish', 'draft', 'private'],
        'sku' => $sku,
        'limit' => 1,
        'return' => 'ids',
    ]);
    if ($ids) {
        $product = wc_get_product($ids[0]);

        return $product instanceof WC_Product ? $product : null;
    }

    return null;
}

/** @return array<int, array<string, mixed>> */
function ybb_sm_product_live_variants(WC_Product $product): array
{
    if (!$product->is_type('variable')) {
        return [];
    }

    $out = [];
    foreach ($product->get_children() as $variationId) {
        $variation = wc_get_product($variationId);
        if (!$variation instanceof WC_Product_Variation) {
            continue;
        }

        $attrs = [];
        foreach ($variation->get_attributes() as $name => $value) {
            $label = wc_attribute_label($name, $product);
            $display = $value;
            if (taxonomy_exists($name) && $value) {
                $term = get_term_by('slug', $value, $name);
                if ($term && !is_wp_error($term)) {
                    $display = $term->name;
                }
            }
            if ($label && $display) {
                $attrs[] = [
                    'attribute' => (string) $label,
                    'value' => (string) $display,
                ];
            }
        }

        $spec = implode(' / ', array_column($attrs, 'value'));
        if ($spec === '') {
            $spec = (string) $variation->get_sku();
        }

        $regular = (float) $variation->get_regular_price();
        $sale = (float) $variation->get_sale_price();
        $price = $sale > 0 ? $sale : $regular;
        $compareAt = ($sale > 0 && $regular > $sale) ? $regular : null;

        $out[] = [
            'spec' => $spec,
            'sku' => (string) $variation->get_sku(),
            'wcId' => (int) $variation->get_id(),
            'price' => $price,
            'compareAtPrice' => $compareAt,
            'available' => $variation->is_in_stock() && $variation->is_purchasable(),
            'wcAttributes' => $attrs,
        ];
    }

    return $out;
}

function ybb_sm_product_price_from_wc(WC_Product $product): array
{
    $regular = (float) $product->get_regular_price();
    $sale = (float) $product->get_sale_price();
    if ($product->is_type('variable')) {
        $regular = (float) $product->get_variation_regular_price('min');
        $sale = (float) $product->get_variation_sale_price('min');
    }
    $price = $sale > 0 ? $sale : $regular;
    $compareAt = ($sale > 0 && $regular > $sale) ? $regular : null;

    return ['price' => $price, 'compareAtPrice' => $compareAt];
}

function ybb_sm_product_live_payload(string $handle, ?WC_Product $product = null): ?array
{
    $handle = sanitize_title($handle);
    if ($handle === '') {
        return null;
    }

    $product = $product instanceof WC_Product ? $product : ybb_sm_product_find_wc($handle);
    if (!$product instanceof WC_Product) {
        return null;
    }

    $override = ybb_sm_product_override_get($handle);
    $prices = ybb_sm_product_price_from_wc($product);
    $variants = ybb_sm_product_live_variants($product);
    $parentSku = (string) $product->get_sku();
    if ($parentSku === '') {
        $parentSku = strtoupper($handle);
    }

    return [
        'handle' => $handle,
        'parentSku' => $parentSku,
        'wcId' => (int) $product->get_id(),
        'wooStatus' => (string) $product->get_status(),
        'titles' => [
            'en' => (string) $product->get_name(),
            'zh' => $override['titleZh'] !== '' ? $override['titleZh'] : (string) $product->get_name(),
            'ja' => $override['titleJa'] !== '' ? $override['titleJa'] : (string) $product->get_name(),
        ],
        'price' => $prices['price'],
        'compareAtPrice' => $prices['compareAtPrice'],
        'available' => $product->is_in_stock() && $product->is_purchasable() && $product->get_status() === 'publish',
        'variants' => $variants,
        'frontHidden' => $override['frontHidden'],
        'content' => [
            'description' => ybb_sm_product_description_payload($product, $override),
            'additionalInfo' => ybb_sm_product_additional_info_payload($product, $override),
        ],
        'purchaseSlogan' => ybb_sm_product_purchase_slogan_payload($override),
        'gallery' => ybb_sm_product_gallery_payload($product, $override),
        'images' => ybb_sm_product_images_from_wc($product),
        'pdpUrl' => home_url('/products/' . $handle),
        'syncedAt' => ybb_sm_synced_at(),
    ];
}

function ybb_sm_product_overrides_public(): array
{
    if (count(ybb_sm_product_overrides_all()) === 0) {
        ybb_sm_maybe_migrate_products();
    }

    $module = ybb_sm_products_module();
    $out = [];
    foreach ($module['overrides'] ?? [] as $handle => $row) {
        if (!is_array($row)) {
            continue;
        }
        $handle = sanitize_title((string) $handle);
        if ($handle === '') {
            continue;
        }
        $titleZh = trim((string) ($row['titleZh'] ?? ''));
        $titleJa = trim((string) ($row['titleJa'] ?? ''));
        $frontHidden = !empty($row['frontHidden']);
        $descriptionZh = trim((string) ($row['descriptionZh'] ?? ''));
        $descriptionJa = trim((string) ($row['descriptionJa'] ?? ''));
        $hideDescription = !empty($row['hideDescription']);
        $hideAdditionalInfo = !empty($row['hideAdditionalInfo']);
        $galleryEnabled = array_key_exists('galleryEnabled', $row)
            ? !empty($row['galleryEnabled'])
            : true;
        $galleryOverrideEnabled = !empty($row['galleryOverrideEnabled']);
        $galleryDefaultIndex = isset($row['galleryDefaultIndex'])
            ? max(0, (int) $row['galleryDefaultIndex'])
            : 0;
        $galleryImages = $row['galleryImages'] ?? [];
        $galleryHideIndexes = $row['galleryHideIndexes'] ?? [];
        $sloganEn = trim((string) ($row['sloganEn'] ?? ''));
        $sloganZh = trim((string) ($row['sloganZh'] ?? ''));
        $sloganJa = trim((string) ($row['sloganJa'] ?? ''));
        $hideSlogan = !empty($row['hideSlogan']);
        if (
            $titleZh === '' && $titleJa === '' && !$frontHidden
            && $descriptionZh === '' && $descriptionJa === ''
            && !$hideDescription && !$hideAdditionalInfo
            && $galleryEnabled && !$galleryOverrideEnabled && $galleryDefaultIndex === 0
            && (is_array($galleryImages) ? $galleryImages === [] : $galleryImages === '')
            && (is_array($galleryHideIndexes) ? $galleryHideIndexes === [] : $galleryHideIndexes === '')
            && $sloganEn === '' && $sloganZh === '' && $sloganJa === ''
            && !$hideSlogan
        ) {
            continue;
        }
        $out[$handle] = [
            'titleZh' => $titleZh,
            'titleJa' => $titleJa,
            'frontHidden' => $frontHidden,
            'descriptionZh' => $descriptionZh,
            'descriptionJa' => $descriptionJa,
            'hideDescription' => $hideDescription,
            'hideAdditionalInfo' => $hideAdditionalInfo,
            'galleryEnabled' => $galleryEnabled,
            'galleryOverrideEnabled' => $galleryOverrideEnabled,
            'galleryDefaultIndex' => $galleryDefaultIndex,
            'galleryImages' => $galleryImages,
            'galleryHideIndexes' => $galleryHideIndexes,
            'sloganEn' => $sloganEn,
            'sloganZh' => $sloganZh,
            'sloganJa' => $sloganJa,
            'hideSlogan' => $hideSlogan,
        ];
    }

    return [
        'enabled' => !empty($module['enabled']),
        'overrides' => $out,
        'syncedAt' => ybb_sm_synced_at(),
    ];
}

function ybb_sm_product_save_override(string $handle, array $input): array|WP_Error
{
    if (!current_user_can('manage_options')) {
        return new WP_Error('forbidden', 'Forbidden', ['status' => 403]);
    }

    $forbidden = ['sku', 'wcId', 'price', 'variants', 'id', 'parentSku', 'descriptionEn'];
    foreach ($forbidden as $key) {
        if (array_key_exists($key, $input)) {
            return new WP_Error(
                'invalid_field',
                'Field "' . $key . '" cannot be overridden here.',
                ['status' => 400]
            );
        }
    }

    $handle = sanitize_title($handle);
    if ($handle === '') {
        return new WP_Error('invalid_handle', 'Invalid handle.', ['status' => 400]);
    }

    $titleZh = sanitize_text_field((string) ($input['titleZh'] ?? ''));
    $titleJa = sanitize_text_field((string) ($input['titleJa'] ?? ''));
    $frontHidden = !empty($input['frontHidden']);
    $descriptionZh = ybb_sm_prepare_description_html((string) ($input['descriptionZh'] ?? ''));
    $descriptionJa = ybb_sm_prepare_description_html((string) ($input['descriptionJa'] ?? ''));
    $hideDescription = !empty($input['hideDescription']);
    $hideAdditionalInfo = !empty($input['hideAdditionalInfo']);
    $galleryEnabled = array_key_exists('galleryEnabled', $input)
        ? !empty($input['galleryEnabled'])
        : true;
    $galleryOverrideEnabled = !empty($input['galleryOverrideEnabled']);
    $galleryDefaultIndex = max(0, (int) ($input['galleryDefaultIndex'] ?? 0));
    $galleryImages = $input['galleryImages'] ?? [];
    if (is_string($galleryImages)) {
        $galleryImages = preg_split('/[\r\n]+/', $galleryImages) ?: [];
    }
    if (!is_array($galleryImages)) {
        $galleryImages = [];
    }
    $galleryImages = array_values(array_filter(array_map(
        static fn ($url) => esc_url_raw(trim((string) $url)),
        $galleryImages
    )));
    $galleryHideIndexes = $input['galleryHideIndexes'] ?? [];
    if (is_string($galleryHideIndexes)) {
        $galleryHideIndexes = preg_split('/[,\s]+/', $galleryHideIndexes) ?: [];
    }
    if (!is_array($galleryHideIndexes)) {
        $galleryHideIndexes = [];
    }
    $galleryHideIndexes = array_values(array_unique(array_filter(array_map(
        static fn ($v) => max(0, (int) $v),
        $galleryHideIndexes
    ), static fn ($v) => $v >= 0)));
    $sloganEn = ybb_sm_sanitize_slogan_text((string) ($input['sloganEn'] ?? ''));
    $sloganZh = ybb_sm_sanitize_slogan_text((string) ($input['sloganZh'] ?? ''));
    $sloganJa = ybb_sm_sanitize_slogan_text((string) ($input['sloganJa'] ?? ''));
    $hideSlogan = !empty($input['hideSlogan']);

    $before = ybb_sm_products_module();
    $overrides = ybb_sm_product_overrides_all();

    if (
        $titleZh === '' && $titleJa === '' && !$frontHidden
        && $descriptionZh === '' && $descriptionJa === ''
        && !$hideDescription && !$hideAdditionalInfo
        && $galleryEnabled && !$galleryOverrideEnabled && $galleryDefaultIndex === 0
        && $galleryImages === [] && $galleryHideIndexes === []
        && $sloganEn === '' && $sloganZh === '' && $sloganJa === ''
        && !$hideSlogan
    ) {
        unset($overrides[$handle]);
    } else {
        $overrides[$handle] = [
            'titleZh' => $titleZh,
            'titleJa' => $titleJa,
            'frontHidden' => $frontHidden,
            'descriptionZh' => $descriptionZh,
            'descriptionJa' => $descriptionJa,
            'hideDescription' => $hideDescription,
            'hideAdditionalInfo' => $hideAdditionalInfo,
            'galleryEnabled' => $galleryEnabled,
            'galleryOverrideEnabled' => $galleryOverrideEnabled,
            'galleryDefaultIndex' => $galleryDefaultIndex,
            'galleryImages' => $galleryImages,
            'galleryHideIndexes' => $galleryHideIndexes,
            'sloganEn' => $sloganEn,
            'sloganZh' => $sloganZh,
            'sloganJa' => $sloganJa,
            'hideSlogan' => $hideSlogan,
            'updatedAt' => gmdate('c'),
        ];
    }

    ybb_sm_product_overrides_save($overrides);

    $all = ybb_sm_get_all();
    $products = $before;
    unset($products['overrides']);
    $products['enabled'] = true;
    $all['products'] = $products;
    update_option(YBB_SM_OPTION, $all);

    if (function_exists('ybb_sm_audit_log_config_save')) {
        ybb_sm_audit_log_config_save('products', $before, $products);
    }

    return ybb_sm_product_live_payload($handle) ?? [
        'handle' => $handle,
        'titles' => ['en' => '', 'zh' => $titleZh, 'ja' => $titleJa],
        'frontHidden' => $frontHidden,
        'syncedAt' => ybb_sm_synced_at(),
    ];
}

function ybb_sm_product_index_meta(): array
{
    $module = ybb_sm_products_module();

    return is_array($module['productIndex'] ?? null) ? $module['productIndex'] : [];
}

function ybb_sm_product_static_handles(): array
{
    $stored = get_option('ybb_sm_static_product_handles', null);
    if (is_array($stored)) {
        return array_values($stored);
    }

    $meta = ybb_sm_product_index_meta();
    $legacy = $meta['staticHandles'] ?? [];

    return is_array($legacy) ? array_values($legacy) : [];
}

/** @param list<string> $handles */
function ybb_sm_product_static_handles_set(array $handles): void
{
    $clean = array_values(array_unique(array_filter(array_map(
        static fn ($h) => sanitize_title((string) $h),
        $handles
    ))));
    update_option('ybb_sm_static_product_handles', $clean, false);
}

function ybb_sm_product_static_handle_set(): array
{
    $handles = ybb_sm_product_static_handles();

    return array_fill_keys($handles, true);
}

function ybb_sm_product_in_static_export(string $handle): bool
{
    $handles = ybb_sm_product_static_handles();
    if ($handles === []) {
        return true;
    }

    return in_array(sanitize_title($handle), $handles, true);
}

function ybb_sm_product_update_index_meta(string $buildId = '', int $productCount = 0, array $handles = []): void
{
    $all = ybb_sm_get_all();
    $products = ybb_sm_products_module();
    $staticHandles = array_values(array_unique(array_filter(array_map(
        static fn ($h) => sanitize_title((string) $h),
        $handles
    ))));
    $products['productIndex'] = [
        'lastBuiltAt' => gmdate('c'),
        'lastBuildId' => sanitize_text_field($buildId),
        'productCount' => max(0, $productCount),
    ];
    if ($staticHandles !== []) {
        ybb_sm_product_static_handles_set($staticHandles);
    }
    $all['products'] = $products;
    update_option(YBB_SM_OPTION, $all);
    if (function_exists('ybb_sm_product_catalog_flush_cache')) {
        ybb_sm_product_catalog_flush_cache();
    } else {
        delete_transient('ybb_sm_product_catalog_v1');
    }
}
