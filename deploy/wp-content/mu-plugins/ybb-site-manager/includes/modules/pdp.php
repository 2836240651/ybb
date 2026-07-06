<?php

if (!defined('ABSPATH')) {
    exit;
}

/** @return array{defaultSlogan: array{en:string,zh:string,ja:string},hideDefaultSloganGlobally:bool} */
function ybb_sm_pdp_defaults(): array
{
    return [
        'defaultSlogan' => [
            'en' => '',
            'zh' => '',
            'ja' => '',
        ],
        'hideDefaultSloganGlobally' => false,
    ];
}

/** Layer D �?site-wide PDP purchase slogan defaults (stored under products.pdp). */
function ybb_sm_pdp_settings(): array
{
    $module = ybb_sm_products_module();
    $pdp = $module['pdp'] ?? [];

    return array_replace(ybb_sm_pdp_defaults(), is_array($pdp) ? $pdp : []);
}

function ybb_sm_sanitize_slogan_text(string $raw): string
{
    return sanitize_textarea_field(wp_strip_all_tags($raw));
}

/** @param array<string, mixed> $override */
function ybb_sm_product_purchase_slogan_payload(array $override): array
{
    $global = ybb_sm_pdp_settings();
    $text = [
        'en' => ybb_sm_sanitize_slogan_text((string) ($override['sloganEn'] ?? '')),
        'zh' => ybb_sm_sanitize_slogan_text((string) ($override['sloganZh'] ?? '')),
        'ja' => ybb_sm_sanitize_slogan_text((string) ($override['sloganJa'] ?? '')),
    ];

    foreach (['en', 'zh', 'ja'] as $lang) {
        if ($text[$lang] === '') {
            $text[$lang] = ybb_sm_sanitize_slogan_text((string) ($global['defaultSlogan'][$lang] ?? ''));
        }
    }

    if (!empty($override['hideSlogan'])) {
        return [
            'visible' => false,
            'text' => $text,
        ];
    }

    $hasCustom = false;
    foreach ($text as $part) {
        if ($part !== '') {
            $hasCustom = true;
            break;
        }
    }

    if (!$hasCustom && !empty($global['hideDefaultSloganGlobally'])) {
        return [
            'visible' => false,
            'text' => $text,
        ];
    }

    return [
        'visible' => true,
        'text' => $text,
    ];
}

/** @param array<string, mixed>|null $input */
function ybb_sm_sanitize_pdp($input, array $existing): array
{
    if (!is_array($input)) {
        return array_replace(ybb_sm_pdp_defaults(), $existing);
    }

    $defaults = ybb_sm_pdp_defaults();
    $rawSlogan = is_array($input['defaultSlogan'] ?? null) ? $input['defaultSlogan'] : [];

    return [
        'defaultSlogan' => [
            'en' => ybb_sm_sanitize_slogan_text((string) ($rawSlogan['en'] ?? '')),
            'zh' => ybb_sm_sanitize_slogan_text((string) ($rawSlogan['zh'] ?? '')),
            'ja' => ybb_sm_sanitize_slogan_text((string) ($rawSlogan['ja'] ?? '')),
        ],
        'hideDefaultSloganGlobally' => ybb_sm_parse_checkbox_enabled($input, 'hideDefaultSloganGlobally', false),
    ];
}

/** @param array<string, mixed> $row */
function ybb_sm_product_override_row_is_empty(array $row): bool
{
    return trim((string) ($row['titleZh'] ?? '')) === ''
        && trim((string) ($row['titleJa'] ?? '')) === ''
        && empty($row['frontHidden'])
        && trim((string) ($row['descriptionZh'] ?? '')) === ''
        && trim((string) ($row['descriptionJa'] ?? '')) === ''
        && empty($row['hideDescription'])
        && empty($row['hideAdditionalInfo'])
        && trim((string) ($row['sloganEn'] ?? '')) === ''
        && trim((string) ($row['sloganZh'] ?? '')) === ''
        && trim((string) ($row['sloganJa'] ?? '')) === ''
        && empty($row['hideSlogan']);
}
