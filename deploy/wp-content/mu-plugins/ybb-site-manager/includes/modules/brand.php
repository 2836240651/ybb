<?php

if (!defined('ABSPATH')) {
    exit;
}

function ybb_sm_brand_get(): array
{
    if (function_exists('ybb_site_brand_get')) {
        $brand = ybb_sm_get_module('brand');
        if (!empty($brand['name'])) {
            $legacy = ybb_site_brand_get();

            return array_replace($legacy, [
                'name' => $brand['name'],
                'tagline' => $brand['tagline'] ?? $legacy['tagline'],
                'logoAlt' => $brand['logoAlt'] ?? $legacy['logoAlt'],
                'logoPath' => $brand['logoPath'] ?? $legacy['logoPath'],
            ]);
        }

        return ybb_site_brand_get();
    }

    $brand = ybb_sm_get_module('brand');
    if (empty($brand)) {
        $brand = ybb_sm_default_module('brand');
    }

    return [
        'name' => (string) ($brand['name'] ?? 'YBB'),
        'tagline' => $brand['tagline'] ?? ['en' => '', 'zh' => '', 'ja' => ''],
        'logoAlt' => (string) ($brand['logoAlt'] ?? 'YBB'),
        'logoPath' => (string) ($brand['logoPath'] ?? '/images/brand/ybb-logo.png'),
        'source' => 'wordpress',
        'syncedAt' => ybb_sm_synced_at(),
    ];
}

function ybb_sm_brand_sync_legacy_option(array $brand): void
{
    if (defined('YBB_BRAND_OPTION')) {
        update_option(YBB_BRAND_OPTION, $brand);
    }
    $name = trim((string) ($brand['name'] ?? ''));
    if ($name !== '') {
        update_option('blogname', $name);
    }
    $en = trim((string) ($brand['tagline']['en'] ?? ''));
    if ($en !== '') {
        update_option('blogdescription', $en);
    }
}
