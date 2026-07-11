<?php

if (!defined('ABSPATH')) {
    exit;
}

/** Built-in PDP tab / review copy when Site Manager fields are empty. */
function ybb_sm_pdp_tab_labels_builtin(): array
{
    return [
        'description' => [
            'en' => 'Description',
            'zh' => '商品描述',
            'ja' => '商品説明',
        ],
        'additionalInfo' => [
            'en' => 'Additional information',
            'zh' => '附加信息',
            'ja' => '追加情報',
        ],
        'reviews' => [
            'en' => 'Reviews ({count})',
            'zh' => '评价 ({count})',
            'ja' => 'レビュー ({count})',
        ],
        'reviewsBadge' => [
            'en' => '{rating} · {count} reviews',
            'zh' => '{rating} · {count} 条评价',
            'ja' => '{rating} · {count} 件のレビュー',
        ],
        'reviewsBadgeNoRating' => [
            'en' => '{count} reviews',
            'zh' => '{count} 条评价',
            'ja' => '{count} 件のレビュー',
        ],
        'writeFirstReview' => [
            'en' => 'Write the first review',
            'zh' => '撰写首条评价',
            'ja' => '最初のレビューを書く',
        ],
        'contentTabsLabel' => [
            'en' => 'Product details',
            'zh' => '商品详情',
            'ja' => '商品詳細',
        ],
    ];
}

/** @return array{defaultSlogan: array{en:string,zh:string,ja:string},hideDefaultSloganGlobally:bool,tabLabels:array<string,array{en:string,zh:string,ja:string}>} */
function ybb_sm_pdp_defaults(): array
{
    $emptyTri = ['en' => '', 'zh' => '', 'ja' => ''];
    $tabKeys = array_keys(ybb_sm_pdp_tab_labels_builtin());
    $tabLabels = [];
    foreach ($tabKeys as $key) {
        $tabLabels[$key] = $emptyTri;
    }

    return [
        'defaultSlogan' => [
            'en' => '',
            'zh' => '',
            'ja' => '',
        ],
        'hideDefaultSloganGlobally' => false,
        'shopPayInstallments' => ybb_sm_shop_pay_installments_defaults(),
        'tabLabels' => $tabLabels,
    ];
}

/** @return array{enabled:bool,installmentCount:int,minPriceUsd:float,template:array{en:string,zh:string,ja:string}} */
function ybb_sm_shop_pay_installments_defaults(): array
{
    return [
        'enabled' => true,
        'installmentCount' => 3,
        'minPriceUsd' => 0.0,
        'template' => [
            'en' => 'Pay in {count} interest-free instalments of {amount} with Shop Pay',
            'zh' => '',
            'ja' => '',
        ],
    ];
}

/** Layer D — site-wide PDP settings (stored under products.pdp). */
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

function ybb_sm_interpolate_installment_template(string $template, float $price, int $count): string
{
    $count = max(2, min(12, $count));
    $per = $count > 0 ? $price / $count : $price;
    if (function_exists('wc_price')) {
        $amount = wc_price($per, ['html' => false]);
        $total = wc_price($price, ['html' => false]);
    } else {
        $amount = '$' . number_format($per, 2);
        $total = '$' . number_format($price, 2);
    }

    return str_replace(
        ['{amount}', '{count}', '{total}'],
        [$amount, (string) $count, $total],
        $template
    );
}

/** @param array<string, mixed> $override */
function ybb_sm_product_shop_pay_installments_payload(array $override, float $price): array
{
    $global = ybb_sm_pdp_settings();
    $cfg = is_array($global['shopPayInstallments'] ?? null)
        ? array_replace(ybb_sm_shop_pay_installments_defaults(), $global['shopPayInstallments'])
        : ybb_sm_shop_pay_installments_defaults();
    $enabled = !empty($cfg['enabled']);
    $count = max(2, min(12, (int) ($cfg['installmentCount'] ?? 3)));
    $min = max(0.0, (float) ($cfg['minPriceUsd'] ?? 0));
    $rawTemplate = is_array($cfg['template'] ?? null) ? $cfg['template'] : [];
    $template = [
        'en' => ybb_sm_sanitize_slogan_text((string) ($rawTemplate['en'] ?? '')),
        'zh' => ybb_sm_sanitize_slogan_text((string) ($rawTemplate['zh'] ?? '')),
        'ja' => ybb_sm_sanitize_slogan_text((string) ($rawTemplate['ja'] ?? '')),
    ];
    foreach (['en', 'zh', 'ja'] as $lang) {
        if ($template[$lang] === '') {
            $template[$lang] = ybb_sm_sanitize_slogan_text(
                (string) (ybb_sm_shop_pay_installments_defaults()['template'][$lang] ?? '')
            );
        }
    }

    $visible = $enabled
        && empty($override['hideShopPayInstallments'])
        && $price > 0
        && ($min <= 0 || $price >= $min);

    $resolved = [];
    foreach (['en', 'zh', 'ja'] as $lang) {
        $resolved[$lang] = $template[$lang] !== ''
            ? ybb_sm_interpolate_installment_template($template[$lang], $price, $count)
            : '';
    }

    return [
        'visible' => $visible,
        'installmentCount' => $count,
        'minPriceUsd' => $min,
        'template' => $template,
        'resolved' => $resolved,
    ];
}

/**
 * Resolved tri-lingual PDP tab / review labels for REST (empty admin field → built-in default).
 *
 * @return array<string, array{en: string, zh: string, ja: string}>
 */
function ybb_sm_pdp_tab_labels_payload(): array
{
    $global = ybb_sm_pdp_settings();
    $stored = is_array($global['tabLabels'] ?? null) ? $global['tabLabels'] : [];
    $builtin = ybb_sm_pdp_tab_labels_builtin();
    $out = [];

    foreach ($builtin as $key => $defaults) {
        $row = is_array($stored[$key] ?? null) ? $stored[$key] : [];
        $out[$key] = [
            'en' => ybb_sm_sanitize_slogan_text((string) ($row['en'] ?? '')) ?: $defaults['en'],
            'zh' => ybb_sm_sanitize_slogan_text((string) ($row['zh'] ?? '')) ?: $defaults['zh'],
            'ja' => ybb_sm_sanitize_slogan_text((string) ($row['ja'] ?? '')) ?: $defaults['ja'],
        ];
    }

    return $out;
}

/** @param array<string, mixed>|null $input */
function ybb_sm_sanitize_pdp_tab_labels($input): array
{
    $builtin = ybb_sm_pdp_tab_labels_builtin();
    $raw = is_array($input) ? $input : [];
    $out = [];

    foreach ($builtin as $key => $_defaults) {
        $row = is_array($raw[$key] ?? null) ? $raw[$key] : [];
        $out[$key] = [
            'en' => ybb_sm_sanitize_slogan_text((string) ($row['en'] ?? '')),
            'zh' => ybb_sm_sanitize_slogan_text((string) ($row['zh'] ?? '')),
            'ja' => ybb_sm_sanitize_slogan_text((string) ($row['ja'] ?? '')),
        ];
    }

    return $out;
}

/** @param array<string, mixed>|null $input */
function ybb_sm_sanitize_pdp($input, array $existing): array
{
    if (!is_array($input)) {
        return array_replace(ybb_sm_pdp_defaults(), $existing);
    }

    $defaults = ybb_sm_pdp_defaults();
    $rawSlogan = is_array($input['defaultSlogan'] ?? null) ? $input['defaultSlogan'] : [];

    $rawSpi = is_array($input['shopPayInstallments'] ?? null) ? $input['shopPayInstallments'] : [];
    $rawSpiTemplate = is_array($rawSpi['template'] ?? null) ? $rawSpi['template'] : [];
    $spiDefaults = ybb_sm_shop_pay_installments_defaults();
    $installmentCount = (int) ($rawSpi['installmentCount'] ?? $spiDefaults['installmentCount']);
    $installmentCount = max(2, min(12, $installmentCount));

    return [
        'defaultSlogan' => [
            'en' => ybb_sm_sanitize_slogan_text((string) ($rawSlogan['en'] ?? '')),
            'zh' => ybb_sm_sanitize_slogan_text((string) ($rawSlogan['zh'] ?? '')),
            'ja' => ybb_sm_sanitize_slogan_text((string) ($rawSlogan['ja'] ?? '')),
        ],
        'hideDefaultSloganGlobally' => ybb_sm_parse_checkbox_enabled($input, 'hideDefaultSloganGlobally', false),
        'shopPayInstallments' => [
            'enabled' => ybb_sm_parse_checkbox_enabled($rawSpi, 'enabled', !empty($spiDefaults['enabled'])),
            'installmentCount' => $installmentCount,
            'minPriceUsd' => max(0.0, (float) ($rawSpi['minPriceUsd'] ?? $spiDefaults['minPriceUsd'])),
            'template' => [
                'en' => ybb_sm_sanitize_slogan_text((string) ($rawSpiTemplate['en'] ?? '')),
                'zh' => ybb_sm_sanitize_slogan_text((string) ($rawSpiTemplate['zh'] ?? '')),
                'ja' => ybb_sm_sanitize_slogan_text((string) ($rawSpiTemplate['ja'] ?? '')),
            ],
        ],
        'tabLabels' => ybb_sm_sanitize_pdp_tab_labels($input['tabLabels'] ?? null),
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
        && empty($row['hideSlogan'])
        && empty($row['hideShopPayInstallments']);
}
