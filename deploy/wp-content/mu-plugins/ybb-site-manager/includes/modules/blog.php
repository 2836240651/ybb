<?php

if (!defined('ABSPATH')) {
    exit;
}

function ybb_sm_blog_defaults(): array
{
    static $blog = null;
    if ($blog !== null) {
        return $blog;
    }

    $path = YBB_SM_DIR . '/includes/blog-defaults.json';
    if (is_readable($path)) {
        $json = json_decode((string) file_get_contents($path), true);
        if (is_array($json)) {
            $blog = $json;

            return $blog;
        }
    }

    $blog = [
        'enabled' => true,
        'handle' => 'news',
        'title' => 'News & Insights',
        'description' => '',
        'latestStoriesEnabled' => true,
        'articles' => [],
    ];

    return $blog;
}

function ybb_sm_blog_resolve_image_url(string $url): string
{
    $url = trim($url);
    if ($url === '') {
        return '';
    }
    if (!preg_match('#^https?://#i', $url)) {
        $url = home_url($url);
    }
    if (str_starts_with($url, 'http://')) {
        $url = 'https://' . substr($url, 7);
    }

    return $url;
}

function ybb_sm_blog_article_href(string $blogHandle, string $articleHandle): string
{
    $blogHandle = trim($blogHandle, '/');
    $articleHandle = trim($articleHandle, '/');

    return home_url('/blogs/' . $blogHandle . '/' . $articleHandle);
}

/** @return array<int, array<string, mixed>> */
function ybb_sm_blog_enabled_articles(?array $data = null): array
{
    $data = $data ?? ybb_sm_get_module('blog');
    if (empty($data['enabled'])) {
        return [];
    }

    $blogHandle = (string) ($data['handle'] ?? 'news');
    $out = [];

    foreach ($data['articles'] ?? [] as $row) {
        if (empty($row['enabled'])) {
            continue;
        }
        $handle = sanitize_title((string) ($row['handle'] ?? ''));
        if ($handle === '' || trim((string) ($row['title'] ?? '')) === '') {
            continue;
        }

        $imageUrl = ybb_sm_blog_resolve_image_url((string) ($row['imageUrl'] ?? ''));
        $content = [];
        foreach ($row['content'] ?? [] as $para) {
            $para = trim((string) $para);
            if ($para !== '') {
                $content[] = $para;
            }
        }

        $out[] = [
            'id' => (string) ($row['id'] ?? 'article-' . $handle),
            'handle' => $handle,
            'title' => (string) ($row['title'] ?? ''),
            'excerpt' => (string) ($row['excerpt'] ?? ''),
            'publishedAt' => (string) ($row['publishedAt'] ?? ''),
            'imageUrl' => $imageUrl,
            'author' => (string) ($row['author'] ?? ''),
            'content' => $content,
            'featuredOnHome' => !empty($row['featuredOnHome']),
            'href' => ybb_sm_blog_article_href($blogHandle, $handle),
        ];
    }

    usort($out, static function (array $a, array $b): int {
        return strcmp($b['publishedAt'] ?? '', $a['publishedAt'] ?? '');
    });

    return $out;
}

function ybb_sm_blog_public(): array
{
    $data = ybb_sm_get_module('blog');
    if (empty($data)) {
        $data = ybb_sm_blog_defaults();
    }

    return [
        'enabled' => !empty($data['enabled']),
        'handle' => (string) ($data['handle'] ?? 'news'),
        'title' => (string) ($data['title'] ?? ''),
        'description' => (string) ($data['description'] ?? ''),
        'latestStoriesEnabled' => !empty($data['latestStoriesEnabled']),
        'articles' => ybb_sm_blog_enabled_articles($data),
        'syncedAt' => ybb_sm_synced_at(),
    ];
}

/** Cards for homepage Latest Stories carousel. */
function ybb_sm_blog_home_cards(): array
{
    $data = ybb_sm_get_module('blog');
    if (empty($data['enabled']) || empty($data['latestStoriesEnabled'])) {
        return [];
    }

    $cards = [];
    foreach (ybb_sm_blog_enabled_articles($data) as $article) {
        if (empty($article['featuredOnHome'])) {
            continue;
        }
        $cards[] = [
            'handle' => $article['handle'],
            'title' => $article['title'],
            'excerpt' => $article['excerpt'],
            'publishedAt' => $article['publishedAt'],
            'image' => $article['imageUrl'],
            'href' => $article['href'],
        ];
    }

    return $cards;
}
