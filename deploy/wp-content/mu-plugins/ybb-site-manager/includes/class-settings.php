<?php

if (!defined('ABSPATH')) {
    exit;
}

function ybb_sm_get_raw(): array
{
    $stored = get_option(YBB_SM_OPTION, null);
    if (!is_array($stored)) {
        return [];
    }

    return $stored;
}

function ybb_sm_get_all(): array
{
    $defaults = ybb_sm_defaults();
    $stored = ybb_sm_get_raw();
    if (empty($stored)) {
        return $defaults;
    }

    $out = $defaults;
    foreach (array_keys($defaults) as $key) {
        if (isset($stored[$key]) && is_array($stored[$key])) {
            $out[$key] = array_replace_recursive($defaults[$key], $stored[$key]);
        }
    }

    return $out;
}

function ybb_sm_get_module(string $module): array
{
    $all = ybb_sm_get_all();

    return is_array($all[$module] ?? null) ? $all[$module] : [];
}

function ybb_sm_update_module(string $module, array $data): void
{
    $all = ybb_sm_get_raw();
    if (empty($all)) {
        $all = ybb_sm_defaults();
    }
    $all[$module] = $data;
    update_option(YBB_SM_OPTION, $all);
}

function ybb_sm_synced_at(): string
{
    return gmdate('c');
}

function ybb_sm_sanitize_labels($input, array $fallback = []): array
{
    $input = is_array($input) ? $input : [];
    $out = ['en' => '', 'zh' => '', 'ja' => ''];
    foreach (['en', 'zh', 'ja'] as $locale) {
        $value = trim((string) ($input[$locale] ?? $fallback[$locale] ?? ''));
        $out[$locale] = sanitize_text_field($value);
    }

    return $out;
}

function ybb_sm_sanitize_href(string $href): string
{
    $href = trim($href);
    if ($href === '') {
        return '';
    }
    if (preg_match('#^https?://#i', $href)) {
        return esc_url_raw($href);
    }

    return '/' . ltrim(sanitize_text_field($href), '/');
}

function ybb_sm_sanitize_image_url(string $url): string
{
    $url = trim($url);
    if ($url === '') {
        return '';
    }
    if (!preg_match('#^https?://#i', $url)) {
        $url = '/' . ltrim($url, '/');
    }

    return esc_url_raw($url, ['http', 'https']);
}
