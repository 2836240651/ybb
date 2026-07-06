<?php

if (!defined('ABSPATH')) {
    exit;
}

function ybb_sm_announcements_public(): array
{
    $data = ybb_sm_get_module('announcements');
    $items = [];
    foreach ($data['items'] ?? [] as $row) {
        if (empty($row['enabled'])) {
            continue;
        }
        $items[] = [
            'id' => (string) ($row['id'] ?? ''),
            'labels' => $row['labels'] ?? [],
            'href' => (string) ($row['href'] ?? ''),
        ];
    }

    return [
        'enabled' => !empty($data['enabled']),
        'items' => $items,
        'syncedAt' => ybb_sm_synced_at(),
    ];
}
