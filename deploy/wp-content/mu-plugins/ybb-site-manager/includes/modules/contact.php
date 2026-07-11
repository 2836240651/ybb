<?php

if (!defined('ABSPATH')) {
    exit;
}

function ybb_sm_contact_get_raw(): array
{
    $data = ybb_sm_get_module('contact');
    if (empty($data)) {
        $data = ybb_sm_default_module('contact');
    }

    return is_array($data) ? $data : [];
}

function ybb_sm_contact_builtin_defaults(): array
{
    return [
        'salesEmail' => 'ybb.sales@yoto.work',
        'phoneNumber' => '+86 13052997260',
        'companyLegalName' => 'Hangzhou Tuodiao Fishing Tackle Co., Ltd.',
        'companyLegalNameZh' => '杭州拓钓渔具用品',
        'intro' => [
            'en' => "We'd love to hear from overseas brands, wholesalers, and tackle retailers. Tell us about your target SKUs, MOQ, and markets — our factory sales team will respond promptly.",
            'zh' => '欢迎海外品牌、批发商与钓具零售商与我们联系。请告知目标 SKU、起订量及目标市场 — 工厂销售团队将及时回复。',
            'ja' => '海外ブランド、卸売業者、タックル小売業者からのご連絡をお待ちしています。対象SKU、MOQ、市場をお知らせください — 工場営業チームが迅速に対応します。',
        ],
        'hoursDetail' => [
            'en' => "Mon–Fri, 9:00–18:00 (GMT+8)\nResponse within 1–2 business days",
            'zh' => "周一至周五 9:00–18:00（GMT+8）\n1–2 个工作日内回复",
            'ja' => "月〜金 9:00–18:00（GMT+8）\n1–2営業日以内に返信",
        ],
    ];
}

function ybb_sm_contact_resolved_defaults(): array
{
    $fileDefaults = ybb_sm_default_module('contact');
    $builtin = ybb_sm_contact_builtin_defaults();

    return array_merge($builtin, is_array($fileDefaults) ? $fileDefaults : []);
}

function ybb_sm_contact_pick_string(array $data, array $defaults, string $key): string
{
    $value = sanitize_text_field((string) ($data[$key] ?? ''));
    if ($value !== '') {
        return $value;
    }

    return sanitize_text_field((string) ($defaults[$key] ?? ''));
}

function ybb_sm_contact_pick_labels(array $data, array $defaults): array
{
    $labels = ybb_sm_sanitize_labels($data, $defaults);
    foreach (['en', 'zh', 'ja'] as $locale) {
        if ($labels[$locale] === '' && !empty($defaults[$locale])) {
            $labels[$locale] = sanitize_text_field((string) $defaults[$locale]);
        }
    }

    return $labels;
}

function ybb_sm_contact_public(): array
{
    $defaults = ybb_sm_contact_resolved_defaults();
    $data = ybb_sm_contact_get_raw();

    $salesEmail = sanitize_email((string) ($data['salesEmail'] ?? $defaults['salesEmail'] ?? ''));
    if ($salesEmail === '') {
        $salesEmail = sanitize_email((string) ($defaults['salesEmail'] ?? 'ybb.sales@yoto.work'));
    }

    // Contact inquiry settings are the mail source of truth (SMTP recipient).
    if (function_exists('ybb_contact_get_settings')) {
        $inquiry = ybb_contact_get_settings();
        $inquiryEmail = sanitize_email((string) ($inquiry['recipientEmail'] ?? ''));
        if ($inquiryEmail !== '') {
            $salesEmail = $inquiryEmail;
        }
    }

    return [
        'salesEmail' => $salesEmail,
        'phoneNumber' => ybb_sm_contact_pick_string($data, $defaults, 'phoneNumber'),
        'companyLegalName' => ybb_sm_contact_pick_string($data, $defaults, 'companyLegalName'),
        'companyLegalNameZh' => ybb_sm_contact_pick_string($data, $defaults, 'companyLegalNameZh'),
        'intro' => ybb_sm_contact_pick_labels($data['intro'] ?? [], $defaults['intro'] ?? []),
        'hoursDetail' => ybb_sm_contact_pick_labels($data['hoursDetail'] ?? [], $defaults['hoursDetail'] ?? []),
        'source' => 'wordpress',
        'syncedAt' => ybb_sm_synced_at(),
    ];
}

function ybb_sm_contact_sync_legacy_option(array $contact): void
{
    if (!defined('YBB_CONTACT_OPTION')) {
        return;
    }

    $email = sanitize_email((string) ($contact['salesEmail'] ?? ''));
    if ($email === '') {
        return;
    }

    $stored = get_option(YBB_CONTACT_OPTION, []);
    if (!is_array($stored)) {
        $stored = [];
    }

    $defaults = function_exists('ybb_contact_defaults') ? ybb_contact_defaults() : [
        'recipientEmail' => $email,
        'rateLimitPerHour' => 5,
    ];

    update_option(YBB_CONTACT_OPTION, [
        'recipientEmail' => $email,
        'rateLimitPerHour' => max(1, (int) ($stored['rateLimitPerHour'] ?? $defaults['rateLimitPerHour'] ?? 5)),
        'smtp' => is_array($stored['smtp'] ?? null) ? $stored['smtp'] : [],
    ], false);
}
