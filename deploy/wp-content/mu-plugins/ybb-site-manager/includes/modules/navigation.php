<?php

if (!defined('ABSPATH')) {
    exit;
}

function ybb_sm_navigation_public(): array
{
    $nav = ybb_sm_get_module('navigation');
    $primary = [];
    foreach ($nav['primaryNav'] ?? [] as $item) {
        if (empty($item['enabled'])) {
            continue;
        }
        $row = [
            'id' => (string) ($item['id'] ?? ''),
            'label' => (string) ($item['label'] ?? ''),
            'labels' => $item['labels'] ?? [],
            'href' => (string) ($item['href'] ?? ''),
        ];
        if (!empty($item['megaMenu']) && is_array($item['megaMenu'])) {
            $row['megaMenu'] = $item['megaMenu'];
        }
        $primary[] = $row;
    }

    $visibleCollections = [];
    foreach ($primary as $item) {
        $hrefs = [(string) ($item['href'] ?? '')];
        foreach ($item['megaMenu']['children'] ?? [] as $child) {
            if (is_array($child) && !empty($child['href'])) {
                $hrefs[] = (string) $child['href'];
            }
        }
        foreach ($hrefs as $href) {
            if (preg_match('#^/collections/([^/?#]+)#', $href, $matches)) {
                $visibleCollections[rawurldecode($matches[1])] = true;
            }
        }
    }

    $footer = $nav['footer'] ?? [];
    $filterLinks = static function (array $rows) use ($visibleCollections): array {
        $out = [];
        foreach ($rows as $row) {
            if (isset($row['enabled']) && empty($row['enabled'])) {
                continue;
            }
            $href = (string) ($row['href'] ?? '');
            if (preg_match('#^/collections/([^/?#]+)#', $href, $matches)) {
                $handle = rawurldecode($matches[1]);
                if (!isset($visibleCollections[$handle])) {
                    continue;
                }
            }
            $out[] = [
                'label' => (string) ($row['label'] ?? ''),
                'labels' => $row['labels'] ?? [],
                'href' => $href,
            ];
        }

        return $out;
    };

    $social = [];
    foreach ($footer['social'] ?? [] as $row) {
        if (empty($row['enabled'])) {
            continue;
        }
        $social[] = [
            'label' => (string) ($row['label'] ?? ''),
            'href' => (string) ($row['href'] ?? ''),
        ];
    }

    return [
        'primaryNav' => $primary,
        'footer' => [
            'quickLinks' => $filterLinks($footer['quickLinks'] ?? []),
            'information' => $filterLinks($footer['information'] ?? []),
            'policies' => $filterLinks($footer['policies'] ?? []),
            'social' => $social,
        ],
        'syncedAt' => ybb_sm_synced_at(),
    ];
}

function ybb_sm_collection_handle_from_href(string $href): ?string
{
    if (preg_match('#^/collections/([^/?#]+)#', $href, $matches)) {
        return rawurldecode($matches[1]);
    }

    return null;
}

/** @return list<string> */
function ybb_sm_collection_category_slugs(string $handle): array
{
    if ($handle === 'other') {
        return [
            'accessories-metal',
            'accessories-plastic',
            'rod-pod-accessories',
            'peripheral-equipment',
        ];
    }

    return [$handle];
}

function ybb_sm_count_published_in_collection(string $handle): int
{
    if ($handle === '' || in_array($handle, ['all', 'new-arrivals', 'oem-odm'], true)) {
        return -1;
    }
    if (!function_exists('wc_get_products')) {
        return -1;
    }

    $ids = wc_get_products([
        'status' => 'publish',
        'limit' => -1,
        'return' => 'ids',
        'parent' => 0,
        'category' => ybb_sm_collection_category_slugs($handle),
    ]);

    return is_array($ids) ? count($ids) : 0;
}

/**
 * @return list<array{handle:string,href:string,label:string,count:int}>
 */
function ybb_sm_navigation_empty_collection_warnings(array $nav): array
{
    $warnings = [];
    $seen = [];

    foreach ($nav['primaryNav'] ?? [] as $item) {
        if (!ybb_sm_item_is_enabled($item)) {
            continue;
        }

        $rows = [
            [
                'href' => (string) ($item['href'] ?? ''),
                'label' => trim((string) ($item['labels']['zh'] ?? $item['label'] ?? $item['id'] ?? '导航项')),
            ],
        ];

        foreach ($item['megaMenu']['children'] ?? [] as $child) {
            if (!is_array($child)) {
                continue;
            }
            $rows[] = [
                'href' => (string) ($child['href'] ?? ''),
                'label' => trim((string) ($child['labels']['zh'] ?? $child['label'] ?? '子类目')),
            ];
        }

        foreach ($rows as $row) {
            $handle = ybb_sm_collection_handle_from_href($row['href']);
            if ($handle === null || isset($seen[$handle])) {
                continue;
            }
            $seen[$handle] = true;
            $count = ybb_sm_count_published_in_collection($handle);
            if ($count === 0) {
                $warnings[] = [
                    'handle' => $handle,
                    'href' => $row['href'],
                    'label' => $row['label'],
                    'count' => 0,
                ];
            }
        }
    }

    return $warnings;
}
