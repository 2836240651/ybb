<?php

if (!defined('ABSPATH')) {
    exit;
}

function ybb_sm_home_get_settings(): array
{
    if (function_exists('ybb_home_settings_get')) {
        $legacy = ybb_home_settings_get();
        $home = ybb_sm_get_module('home');
        if (!empty($home)) {
            return array_replace($legacy, $home);
        }

        return $legacy;
    }

    $home = ybb_sm_get_module('home');
    if (!empty($home)) {
        return array_replace([
            'wholesaleCollectionsEnabled' => true,
            'latestStoriesEnabled' => true,
            'latestStories' => [],
            'hotProductsEnabled' => true,
            'hotProductsAutoplayMs' => 4000,
            'hotProducts' => [],
        ], $home);
    }

    return ybb_sm_default_module('home') ?: [];
}

function ybb_sm_sanitize_home($input, array $existing): array
{
    if (!is_array($input)) {
        return $existing ?: ybb_sm_home_get_settings();
    }

    if (function_exists('ybb_home_settings_sanitize')) {
        return ybb_home_settings_sanitize($input);
    }

    return $existing;
}

function ybb_sm_home_sync_legacy_option(array $home): void
{
    if (defined('YBB_HOME_OPTION')) {
        update_option(YBB_HOME_OPTION, $home);
    }
    $all = ybb_sm_get_raw();
    if (empty($all)) {
        $all = ybb_sm_defaults();
    }
    $all['home'] = $home;
    update_option(YBB_SM_OPTION, $all);
}

/** Keep blog.latestStoriesEnabled aligned with the homepage master toggle. */
function ybb_sm_home_sync_blog_latest_stories_flag(bool $enabled): void
{
    $all = ybb_sm_get_raw();
    if (empty($all)) {
        $all = ybb_sm_defaults();
    }
    if (empty($all['blog']) || !is_array($all['blog'])) {
        $all['blog'] = function_exists('ybb_sm_blog_defaults') ? ybb_sm_blog_defaults() : [];
    }
    $all['blog']['latestStoriesEnabled'] = $enabled;
    update_option(YBB_SM_OPTION, $all);
}

function ybb_sm_home_settings_public(): array
{
    $settings = ybb_sm_home_get_settings();

    return array_merge($settings, [
        'source' => 'wordpress',
        'syncedAt' => ybb_sm_synced_at(),
    ]);
}

function ybb_sm_hot_products_public(): array
{
    $settings = ybb_sm_home_get_settings();
    if (empty($settings['hotProductsEnabled'])) {
        return [
            'enabled' => false,
            'autoplayMs' => (int) ($settings['hotProductsAutoplayMs'] ?? 4000),
            'products' => [],
            'syncedAt' => ybb_sm_synced_at(),
        ];
    }

    $products = function_exists('ybb_home_hot_products_public')
        ? ybb_home_hot_products_public()
        : [];

    return [
        'enabled' => !empty($products),
        'autoplayMs' => (int) ($settings['hotProductsAutoplayMs'] ?? 4000),
        'products' => $products,
        'syncedAt' => ybb_sm_synced_at(),
    ];
}

function ybb_sm_latest_stories_public(): array
{
    $settings = ybb_sm_home_get_settings();
    if (empty($settings['latestStoriesEnabled'])) {
        return [
            'enabled' => false,
            'articles' => [],
            'syncedAt' => ybb_sm_synced_at(),
        ];
    }

    $articles = [];
    if (function_exists('ybb_sm_blog_home_cards')) {
        $articles = ybb_sm_blog_home_cards();
    }
    if ($articles === [] && function_exists('ybb_home_latest_stories_public')) {
        $articles = ybb_home_latest_stories_public();
    }

    return [
        'enabled' => !empty($articles),
        'articles' => $articles,
        'syncedAt' => ybb_sm_synced_at(),
    ];
}
