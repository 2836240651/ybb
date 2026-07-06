<?php

if (!defined('ABSPATH')) {
    exit;
}

function ybb_sm_video_public(): array
{
    $data = ybb_sm_get_module('video');
    $videoUrl = (string) ($data['videoUrl'] ?? '');
    if ($videoUrl !== '' && !preg_match('#^https?://#i', $videoUrl)) {
        $videoUrl = home_url($videoUrl);
    }
    $posterUrl = (string) ($data['posterUrl'] ?? '');
    if ($posterUrl !== '' && !preg_match('#^https?://#i', $posterUrl)) {
        $posterUrl = home_url($posterUrl);
    }

    return [
        'enabled' => !empty($data['enabled']),
        'videoUrl' => $videoUrl,
        'posterUrl' => $posterUrl,
        'labels' => $data['labels'] ?? [],
        'syncedAt' => ybb_sm_synced_at(),
    ];
}
