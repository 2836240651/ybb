<?php

if (!defined('ABSPATH')) {
    exit;
}

function ybb_sm_defaults(): array
{
    static $defaults = null;
    if ($defaults !== null) {
        return $defaults;
    }

    $path = YBB_SM_DIR . '/includes/defaults-data.json';
    if (is_readable($path)) {
        $json = json_decode((string) file_get_contents($path), true);
        if (is_array($json)) {
            $defaults = $json;
            if (empty($defaults['blog']) || empty($defaults['blog']['articles'])) {
                $defaults['blog'] = ybb_sm_blog_defaults();
            }

            return $defaults;
        }
    }

    $defaults = [
        'navigation' => ['primaryNav' => [], 'footer' => ['quickLinks' => [], 'information' => [], 'policies' => [], 'social' => []]],
        'announcements' => ['enabled' => true, 'items' => []],
        'hero' => ['enabled' => true, 'autoplayMs' => 7000, 'slides' => []],
        'blog' => ybb_sm_blog_defaults(),
        'products' => ybb_sm_products_defaults(),
        'home' => [],
        'video' => ['enabled' => true, 'videoUrl' => '', 'posterUrl' => '', 'labels' => []],
        'featured' => ['enabled' => true, 'handle' => ''],
        'brand' => ['name' => 'YBB', 'tagline' => ['en' => '', 'zh' => '', 'ja' => ''], 'logoAlt' => 'YBB', 'logoPath' => '/images/brand/ybb-logo.png'],
        'deploy' => ['secret' => '', 'state' => 'idle', 'pending' => false, 'pendingUntil' => null, 'lastBuildId' => '', 'lastError' => '', 'startedAt' => null, 'finishedAt' => null, 'trigger' => ''],
    ];

    return $defaults;
}

function ybb_sm_default_module(string $module): array
{
    $all = ybb_sm_defaults();

    return is_array($all[$module] ?? null) ? $all[$module] : [];
}
