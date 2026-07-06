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

function ybb_sm_contact_public(): array
{
    $defaults = ybb_sm_default_module('contact');
    $data = ybb_sm_contact_get_raw();

    $salesEmail = sanitize_email((string) ($data['salesEmail'] ?? $defaults['salesEmail'] ?? ''));
    if ($salesEmail === '') {
        $salesEmail = sanitize_email((string) ($defaults['salesEmail'] ?? 'carpybb@gmail.com'));
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
        'phoneNumber' => sanitize_text_field((string) ($data['phoneNumber'] ?? $defaults['phoneNumber'] ?? '')),
        'companyLegalName' => sanitize_text_field((string) ($data['companyLegalName'] ?? $defaults['companyLegalName'] ?? '')),
        'companyLegalNameZh' => sanitize_text_field((string) ($data['companyLegalNameZh'] ?? $defaults['companyLegalNameZh'] ?? '')),
        'intro' => ybb_sm_sanitize_labels($data['intro'] ?? [], $defaults['intro'] ?? []),
        'hoursDetail' => ybb_sm_sanitize_labels($data['hoursDetail'] ?? [], $defaults['hoursDetail'] ?? []),
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
