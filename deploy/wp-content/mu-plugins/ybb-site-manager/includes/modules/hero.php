<?php

if (!defined('ABSPATH')) {
    exit;
}

function ybb_sm_hero_public(): array
{
    $data = ybb_sm_get_module('hero');
    $slides = [];
    foreach ($data['slides'] ?? [] as $row) {
        if (empty($row['enabled'])) {
            continue;
        }
        $imageUrl = (string) ($row['imageUrl'] ?? '');
        if ($imageUrl !== '' && !preg_match('#^https?://#i', $imageUrl)) {
            $imageUrl = home_url($imageUrl);
        }
        $slides[] = [
            'id' => (string) ($row['id'] ?? ''),
            'href' => (string) ($row['href'] ?? ''),
            'imageUrl' => $imageUrl,
            'labels' => $row['labels'] ?? [],
        ];
    }

    return [
        'enabled' => !empty($data['enabled']),
        'autoplayMs' => (int) ($data['autoplayMs'] ?? 7000),
        'slides' => $slides,
        'syncedAt' => ybb_sm_synced_at(),
    ];
}
