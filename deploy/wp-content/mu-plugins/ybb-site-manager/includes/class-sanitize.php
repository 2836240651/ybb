<?php

if (!defined('ABSPATH')) {
    exit;
}

/** Parse admin checkbox: hidden=0 + checkbox=1; missing key keeps $default. */
function ybb_sm_parse_checkbox_enabled(array $input, string $key, bool $default = true): bool
{
    if (!array_key_exists($key, $input)) {
        return $default;
    }

    return !empty($input[$key]) && (string) $input[$key] !== '0';
}

function ybb_sm_item_is_enabled(array $item): bool
{
    return !isset($item['enabled']) || !empty($item['enabled']);
}

function ybb_sm_sanitize_settings($input): array
{
    $input = is_array($input) ? $input : [];
    $existing = ybb_sm_get_all();
    $module = sanitize_key((string) ($_POST['ybb_sm_module'] ?? ''));

    $out = $existing;

    if ($module === 'navigation' || isset($input['navigation'])) {
        $out['navigation'] = ybb_sm_sanitize_navigation($input['navigation'] ?? null, $existing['navigation']);
        if ($module === 'navigation' && function_exists('ybb_sm_navigation_empty_collection_warnings')) {
            $warnings = ybb_sm_navigation_empty_collection_warnings($out['navigation']);
            if ($warnings !== [] && function_exists('get_current_user_id')) {
                set_transient(
                    'ybb_sm_nav_empty_' . get_current_user_id(),
                    $warnings,
                    120
                );
            }
        }
    }
    if ($module === 'announcements' || isset($input['announcements'])) {
        $out['announcements'] = ybb_sm_sanitize_announcements($input['announcements'] ?? null, $existing['announcements']);
    }
    if ($module === 'hero' || isset($input['hero'])) {
        $out['hero'] = ybb_sm_sanitize_hero($input['hero'] ?? null, $existing['hero']);
    }
    if ($module === 'home' || isset($input['home'])) {
        $out['home'] = ybb_sm_sanitize_home($input['home'] ?? null, $existing['home']);
        ybb_sm_home_sync_legacy_option($out['home']);
    }
    if ($module === 'video' || isset($input['video'])) {
        $out['video'] = ybb_sm_sanitize_video($input['video'] ?? null, $existing['video']);
    }
    if ($module === 'featured' || isset($input['featured'])) {
        $out['featured'] = ybb_sm_sanitize_featured($input['featured'] ?? null, $existing['featured']);
    }
    if ($module === 'blog' || isset($input['blog'])) {
        $out['blog'] = ybb_sm_sanitize_blog($input['blog'] ?? null, $existing['blog'] ?? ybb_sm_blog_defaults());
    }
    if ($module === 'products' || isset($input['products'])) {
        $out['products'] = ybb_sm_sanitize_products($input['products'] ?? null, $existing['products'] ?? ybb_sm_products_defaults());
    }
    if ($module === 'brand' || isset($input['brand'])) {
        $out['brand'] = ybb_sm_sanitize_brand($input['brand'] ?? null, $existing['brand']);
        ybb_sm_brand_sync_legacy_option($out['brand']);
    }
    if ($module === 'contact' || isset($input['contact'])) {
        $out['contact'] = ybb_sm_sanitize_contact($input['contact'] ?? null, $existing['contact']);
        ybb_sm_contact_sync_legacy_option($out['contact']);
    }
    if ($module === 'deploy' || isset($input['deploy'])) {
        $out['deploy'] = ybb_sm_sanitize_deploy_admin($input['deploy'] ?? null, $existing['deploy']);
    }

    if ($module !== '' && in_array($module, ['navigation', 'announcements', 'hero', 'home', 'video', 'featured', 'blog', 'products', 'brand', 'contact', 'deploy'], true)) {
        $GLOBALS['ybb_sm_audit_pending'] = [
            'module' => $module,
            'before' => $existing,
        ];
    }

    if ($module === '' && !empty($input)) {
        foreach (['navigation', 'announcements', 'hero', 'home', 'video', 'featured', 'blog', 'brand', 'contact'] as $key) {
            if (isset($input[$key]) && is_array($input[$key])) {
                $fn = 'ybb_sm_sanitize_' . $key;
                if ($key === 'home') {
                    $out[$key] = ybb_sm_sanitize_home($input[$key], $existing[$key]);
                    ybb_sm_home_sync_legacy_option($out[$key]);
                } elseif ($key === 'brand') {
                    $out[$key] = ybb_sm_sanitize_brand($input[$key], $existing[$key]);
                    ybb_sm_brand_sync_legacy_option($out[$key]);
                } elseif ($key === 'contact') {
                    $out[$key] = ybb_sm_sanitize_contact($input[$key], $existing[$key]);
                    ybb_sm_contact_sync_legacy_option($out[$key]);
                } elseif (function_exists($fn)) {
                    $out[$key] = $fn($input[$key], $existing[$key]);
                }
            }
        }
    }

    return $out;
}

function ybb_sm_sanitize_nav_link_row($row, int $index, string $prefix): array
{
    $row = is_array($row) ? $row : [];
    $label = sanitize_text_field($row['label'] ?? ('Item ' . ($index + 1)));

    return [
        'id' => sanitize_key($row['id'] ?? ($prefix . '-' . ($index + 1))),
        'label' => $label,
        'labels' => ybb_sm_sanitize_labels($row['labels'] ?? [], ['en' => $label]),
        'href' => ybb_sm_sanitize_href((string) ($row['href'] ?? '')),
        'enabled' => ybb_sm_parse_checkbox_enabled($row, 'enabled', true),
        'megaMenu' => ybb_sm_sanitize_mega_menu($row['megaMenu'] ?? null),
    ];
}

function ybb_sm_sanitize_mega_menu($mega): ?array
{
    if (!is_array($mega) || empty($mega['children'])) {
        return null;
    }

    $children = [];
    foreach (array_values($mega['children']) as $i => $child) {
        if (!is_array($child)) {
            continue;
        }
        $label = sanitize_text_field($child['label'] ?? ('Child ' . ($i + 1)));
        $children[] = [
            'label' => $label,
            'labels' => ybb_sm_sanitize_labels($child['labels'] ?? [], ['en' => $label]),
            'href' => ybb_sm_sanitize_href((string) ($child['href'] ?? '')),
            'featuredProducts' => array_values(array_filter(array_map('sanitize_title', (array) ($child['featuredProducts'] ?? [])))),
        ];
    }

    $shopLabel = sanitize_text_field($mega['shopAll']['label'] ?? 'Shop all');
    $variant = sanitize_key($mega['variant'] ?? 'default');

    return [
        'variant' => in_array($variant, ['default', 'oem', 'category'], true) ? $variant : 'default',
        'children' => $children,
        'shopAll' => [
            'label' => $shopLabel,
            'labels' => ybb_sm_sanitize_labels($mega['shopAll']['labels'] ?? [], ['en' => $shopLabel]),
            'href' => ybb_sm_sanitize_href((string) ($mega['shopAll']['href'] ?? '')),
        ],
    ];
}

function ybb_sm_sanitize_navigation($input, array $existing): array
{
    if (!is_array($input)) {
        return $existing;
    }

    $primary = [];
    if (isset($input['primaryNav']) && is_array($input['primaryNav'])) {
        foreach (array_values($input['primaryNav']) as $i => $row) {
            $item = ybb_sm_sanitize_nav_link_row($row, $i, 'nav');
            if ($item['href'] === '' && $item['label'] === '') {
                continue;
            }
            if ($item['megaMenu'] === null) {
                unset($item['megaMenu']);
            }
            $primary[] = $item;
        }
    } else {
        $primary = $existing['primaryNav'] ?? [];
    }

    $footer = $existing['footer'] ?? [];
    foreach (['quickLinks', 'information', 'policies'] as $section) {
        if (isset($input['footer'][$section]) && is_array($input['footer'][$section])) {
            $rows = [];
            foreach (array_values($input['footer'][$section]) as $i => $row) {
                $item = ybb_sm_sanitize_nav_link_row($row, $i, substr($section, 0, 2));
                unset($item['megaMenu']);
                if ($item['href'] !== '' || $item['label'] !== '') {
                    $rows[] = $item;
                }
            }
            $footer[$section] = $rows;
        }
    }
    if (isset($input['footer']['social']) && is_array($input['footer']['social'])) {
        $social = [];
        foreach (array_values($input['footer']['social']) as $i => $row) {
            if (!is_array($row)) {
                continue;
            }
            $label = sanitize_text_field($row['label'] ?? ('Social ' . ($i + 1)));
            $href = esc_url_raw(trim((string) ($row['href'] ?? '')));
            if ($href === '') {
                continue;
            }
            $social[] = [
                'id' => sanitize_key($row['id'] ?? ('social-' . ($i + 1))),
                'label' => $label,
                'labels' => ybb_sm_sanitize_labels($row['labels'] ?? [], ['en' => $label]),
                'href' => $href,
                'enabled' => ybb_sm_parse_checkbox_enabled($row, 'enabled', true),
            ];
        }
        $footer['social'] = $social;
    }

    return [
        'primaryNav' => $primary ?: ($existing['primaryNav'] ?? []),
        'footer' => $footer,
    ];
}

function ybb_sm_sanitize_announcements($input, array $existing): array
{
    if (!is_array($input)) {
        return $existing;
    }

    $items = [];
    if (isset($input['items']) && is_array($input['items'])) {
        foreach (array_values($input['items']) as $i => $row) {
            if (!is_array($row)) {
                continue;
            }
            $id = sanitize_key($row['id'] ?? ('ann-' . ($i + 1)));
            $labels = ybb_sm_sanitize_labels($row['labels'] ?? []);
            if ($labels['en'] === '' && $labels['zh'] === '' && $labels['ja'] === '') {
                continue;
            }
            $items[] = [
                'id' => $id,
                'labels' => $labels,
                'href' => ybb_sm_sanitize_href((string) ($row['href'] ?? '')),
                'enabled' => ybb_sm_parse_checkbox_enabled($row, 'enabled', true),
            ];
        }
    } else {
        $items = $existing['items'] ?? [];
    }

    return [
        'enabled' => ybb_sm_parse_checkbox_enabled($input, 'enabled', !empty($existing['enabled'])),
        'items' => $items ?: ($existing['items'] ?? []),
    ];
}

function ybb_sm_sanitize_hero($input, array $existing): array
{
    if (!is_array($input)) {
        return $existing;
    }

    $slides = [];
    if (isset($input['slides']) && is_array($input['slides'])) {
        foreach (array_values($input['slides']) as $i => $row) {
            if (!is_array($row)) {
                continue;
            }
            $id = sanitize_key($row['id'] ?? ('slide-' . ($i + 1)));
            $labels = ybb_sm_sanitize_labels($row['labels'] ?? []);
            $imageUrl = ybb_sm_sanitize_image_url((string) ($row['imageUrl'] ?? ''));
            if ($imageUrl === '' && $labels['en'] === '') {
                continue;
            }
            $slides[] = [
                'id' => $id,
                'href' => ybb_sm_sanitize_href((string) ($row['href'] ?? '')),
                'imageUrl' => $imageUrl,
                'labels' => $labels,
                'enabled' => ybb_sm_parse_checkbox_enabled($row, 'enabled', true),
            ];
        }
    } else {
        $slides = $existing['slides'] ?? [];
    }

    $autoplayMs = isset($input['autoplayMs']) ? (int) $input['autoplayMs'] : (int) ($existing['autoplayMs'] ?? 7000);
    if ($autoplayMs < 3000) {
        $autoplayMs = 3000;
    }
    if ($autoplayMs > 20000) {
        $autoplayMs = 20000;
    }

    return [
        'enabled' => ybb_sm_parse_checkbox_enabled($input, 'enabled', !empty($existing['enabled'])),
        'autoplayMs' => $autoplayMs,
        'slides' => $slides ?: ($existing['slides'] ?? []),
    ];
}

function ybb_sm_sanitize_blog_block_type(string $type): string
{
    $type = sanitize_key($type);
    $map = [
        'paragraph' => 'paragraph',
        'heading' => 'heading',
        'quote' => 'quote',
        'image' => 'image',
        'mediatext' => 'mediaText',
        'mediaText' => 'mediaText',
        'checklist' => 'checklist',
        'cta' => 'cta',
    ];

    return $map[$type] ?? '';
}

function ybb_sm_sanitize_blog_block_items($items): array
{
    if (is_string($items)) {
        $items = preg_split('/[\r\n]+/', $items) ?: [];
    }
    if (!is_array($items)) {
        return [];
    }

    $out = [];
    foreach ($items as $item) {
        $item = trim(sanitize_text_field((string) $item));
        if ($item !== '') {
            $out[] = $item;
        }
    }

    return $out;
}

function ybb_sm_sanitize_blog_content_blocks($input): array
{
    if (!is_array($input)) {
        return [];
    }

    $blocks = [];
    foreach (array_values($input) as $i => $row) {
        if (!is_array($row)) {
            continue;
        }
        $type = ybb_sm_sanitize_blog_block_type((string) ($row['type'] ?? ''));
        if ($type === '') {
            continue;
        }

        $block = [
            'id' => sanitize_key($row['id'] ?? ('block-' . ($i + 1))),
            'type' => $type,
            'enabled' => ybb_sm_parse_checkbox_enabled($row, 'enabled', true),
        ];

        if ($type === 'paragraph') {
            $block['text'] = sanitize_textarea_field((string) ($row['text'] ?? ''));
            if (trim($block['text']) === '') {
                continue;
            }
        } elseif ($type === 'heading') {
            $block['text'] = sanitize_text_field((string) ($row['text'] ?? ''));
            $level = sanitize_key((string) ($row['level'] ?? 'h2'));
            $block['level'] = in_array($level, ['h2', 'h3'], true) ? $level : 'h2';
            if ($block['text'] === '') {
                continue;
            }
        } elseif ($type === 'quote') {
            $block['text'] = sanitize_textarea_field((string) ($row['text'] ?? ''));
            $block['caption'] = sanitize_text_field((string) ($row['caption'] ?? ''));
            if (trim($block['text']) === '') {
                continue;
            }
        } elseif ($type === 'image') {
            $block['imageUrl'] = ybb_sm_sanitize_image_url((string) ($row['imageUrl'] ?? ''));
            $block['alt'] = sanitize_text_field((string) ($row['alt'] ?? ''));
            $block['caption'] = sanitize_text_field((string) ($row['caption'] ?? ''));
            $width = sanitize_key((string) ($row['width'] ?? 'wide'));
            $block['width'] = in_array($width, ['prose', 'wide'], true) ? $width : 'wide';
            if ($block['imageUrl'] === '') {
                continue;
            }
        } elseif ($type === 'mediaText') {
            $block['imageUrl'] = ybb_sm_sanitize_image_url((string) ($row['imageUrl'] ?? ''));
            $block['alt'] = sanitize_text_field((string) ($row['alt'] ?? ''));
            $block['eyebrow'] = sanitize_text_field((string) ($row['eyebrow'] ?? ''));
            $block['title'] = sanitize_text_field((string) ($row['title'] ?? ''));
            $block['text'] = sanitize_textarea_field((string) ($row['text'] ?? ''));
            $side = sanitize_key((string) ($row['imageSide'] ?? 'left'));
            $block['imageSide'] = in_array($side, ['left', 'right'], true) ? $side : 'left';
            if ($block['imageUrl'] === '' && $block['title'] === '' && trim($block['text']) === '') {
                continue;
            }
        } elseif ($type === 'checklist') {
            $block['title'] = sanitize_text_field((string) ($row['title'] ?? ''));
            $block['items'] = ybb_sm_sanitize_blog_block_items($row['items'] ?? []);
            if ($block['title'] === '' && $block['items'] === []) {
                continue;
            }
        } elseif ($type === 'cta') {
            $block['title'] = sanitize_text_field((string) ($row['title'] ?? ''));
            $block['text'] = sanitize_textarea_field((string) ($row['text'] ?? ''));
            $block['buttonLabel'] = sanitize_text_field((string) ($row['buttonLabel'] ?? ''));
            $block['href'] = ybb_sm_sanitize_href((string) ($row['href'] ?? ''));
            if ($block['title'] === '' && trim($block['text']) === '' && $block['buttonLabel'] === '') {
                continue;
            }
        }

        $blocks[] = $block;
    }

    return $blocks;
}

function ybb_sm_sanitize_blog($input, array $existing): array
{
    if (!is_array($input)) {
        return $existing ?: ybb_sm_blog_defaults();
    }

    $defaults = ybb_sm_blog_defaults();
    $articles = [];
    if (isset($input['articles']) && is_array($input['articles'])) {
        foreach (array_values($input['articles']) as $i => $row) {
            if (!is_array($row)) {
                continue;
            }
            $handle = sanitize_title((string) ($row['handle'] ?? ''));
            $title = sanitize_text_field((string) ($row['title'] ?? ''));
            if ($handle === '' && $title === '') {
                continue;
            }
            if ($handle === '') {
                $handle = sanitize_title($title);
            }

            $content = [];
            if (isset($row['content']) && is_array($row['content'])) {
                foreach ($row['content'] as $para) {
                    $para = trim(sanitize_textarea_field((string) $para));
                    if ($para !== '') {
                        $content[] = $para;
                    }
                }
            } elseif (isset($row['contentText'])) {
                $raw = sanitize_textarea_field((string) $row['contentText']);
                foreach (preg_split("/\r\n\r\n|\n\n/", $raw) as $para) {
                    $para = trim($para);
                    if ($para !== '') {
                        $content[] = $para;
                    }
                }
            }

            $articles[] = [
                'id' => sanitize_key($row['id'] ?? ('article-' . $handle)),
                'enabled' => ybb_sm_parse_checkbox_enabled($row, 'enabled', true),
                'featuredOnHome' => ybb_sm_parse_checkbox_enabled($row, 'featuredOnHome', false),
                'handle' => $handle,
                'title' => $title,
                'excerpt' => sanitize_textarea_field((string) ($row['excerpt'] ?? '')),
                'publishedAt' => sanitize_text_field((string) ($row['publishedAt'] ?? '')),
                'imageUrl' => ybb_sm_sanitize_image_url((string) ($row['imageUrl'] ?? '')),
                'author' => sanitize_text_field((string) ($row['author'] ?? '')),
                'content' => $content,
                'contentBlocks' => ybb_sm_sanitize_blog_content_blocks($row['contentBlocks'] ?? []),
            ];
        }
    } else {
        $articles = $existing['articles'] ?? $defaults['articles'];
    }

    return [
        'enabled' => ybb_sm_parse_checkbox_enabled($input, 'enabled', !empty($existing['enabled'])),
        'handle' => sanitize_title($input['handle'] ?? ($existing['handle'] ?? $defaults['handle'])),
        'title' => sanitize_text_field($input['title'] ?? ($existing['title'] ?? $defaults['title'])),
        'description' => sanitize_textarea_field($input['description'] ?? ($existing['description'] ?? $defaults['description'])),
        'latestStoriesEnabled' => ybb_sm_parse_checkbox_enabled(
            $input,
            'latestStoriesEnabled',
            !empty($existing['latestStoriesEnabled'])
        ),
        'articles' => $articles ?: ($existing['articles'] ?? []),
    ];
}

function ybb_sm_sanitize_video($input, array $existing): array
{
    if (!is_array($input)) {
        return $existing;
    }

    $labels = $existing['labels'] ?? [];
    foreach (['title', 'body', 'cta'] as $field) {
        if (isset($input['labels'][$field])) {
            $labels[$field] = ybb_sm_sanitize_labels($input['labels'][$field], $labels[$field] ?? []);
        }
    }

    return [
        'enabled' => ybb_sm_parse_checkbox_enabled($input, 'enabled', !empty($existing['enabled'])),
        'videoUrl' => isset($input['videoUrl']) ? ybb_sm_sanitize_image_url((string) $input['videoUrl']) : ($existing['videoUrl'] ?? ''),
        'posterUrl' => isset($input['posterUrl']) ? ybb_sm_sanitize_image_url((string) $input['posterUrl']) : ($existing['posterUrl'] ?? ''),
        'labels' => $labels,
    ];
}

function ybb_sm_sanitize_featured($input, array $existing): array
{
    if (!is_array($input)) {
        return $existing;
    }

    return [
        'enabled' => ybb_sm_parse_checkbox_enabled($input, 'enabled', !empty($existing['enabled'])),
        'handle' => sanitize_title($input['handle'] ?? ($existing['handle'] ?? '')),
    ];
}

function ybb_sm_sanitize_brand($input, array $existing): array
{
    if (!is_array($input)) {
        return $existing;
    }

    $defaults = ybb_sm_default_module('brand');
    $name = sanitize_text_field($input['name'] ?? ($existing['name'] ?? $defaults['name']));

    return [
        'name' => $name !== '' ? $name : $defaults['name'],
        'tagline' => ybb_sm_sanitize_labels($input['tagline'] ?? [], $existing['tagline'] ?? $defaults['tagline']),
        'logoAlt' => sanitize_text_field($input['logoAlt'] ?? ($existing['logoAlt'] ?? $name)),
        'logoPath' => isset($input['logoPath']) ? ybb_sm_sanitize_image_url((string) $input['logoPath']) : ($existing['logoPath'] ?? $defaults['logoPath']),
    ];
}

function ybb_sm_sanitize_contact($input, array $existing): array
{
    if (!is_array($input)) {
        return $existing;
    }

    $defaults = ybb_sm_default_module('contact');
    $salesEmail = sanitize_email((string) ($input['salesEmail'] ?? ($existing['salesEmail'] ?? $defaults['salesEmail'] ?? '')));
    if ($salesEmail === '') {
        $salesEmail = sanitize_email((string) ($defaults['salesEmail'] ?? 'carpybb@gmail.com'));
    }

    return [
        'salesEmail' => $salesEmail,
        'phoneNumber' => sanitize_text_field($input['phoneNumber'] ?? ($existing['phoneNumber'] ?? $defaults['phoneNumber'] ?? '')),
        'companyLegalName' => sanitize_text_field($input['companyLegalName'] ?? ($existing['companyLegalName'] ?? $defaults['companyLegalName'] ?? '')),
        'companyLegalNameZh' => sanitize_text_field($input['companyLegalNameZh'] ?? ($existing['companyLegalNameZh'] ?? $defaults['companyLegalNameZh'] ?? '')),
        'intro' => ybb_sm_sanitize_labels($input['intro'] ?? [], $existing['intro'] ?? $defaults['intro'] ?? []),
        'hoursDetail' => ybb_sm_sanitize_labels($input['hoursDetail'] ?? [], $existing['hoursDetail'] ?? $defaults['hoursDetail'] ?? []),
    ];
}

function ybb_sm_sanitize_products($input, array $existing): array
{
    if (!is_array($input)) {
        return $existing ?: ybb_sm_products_defaults();
    }

    $defaults = ybb_sm_products_defaults();
    $overrides = function_exists('ybb_sm_product_overrides_all')
        ? ybb_sm_product_overrides_all()
        : (is_array($existing['overrides'] ?? null) ? $existing['overrides'] : []);

    if (isset($input['overrides']) && is_array($input['overrides'])) {
        foreach ($input['overrides'] as $handle => $row) {
            if (!is_array($row)) {
                continue;
            }
            $handle = sanitize_title((string) $handle);
            if ($handle === '') {
                continue;
            }

            $titleZh = sanitize_text_field((string) ($row['titleZh'] ?? ''));
            $titleJa = sanitize_text_field((string) ($row['titleJa'] ?? ''));
            $frontHidden = ybb_sm_parse_checkbox_enabled($row, 'frontHidden', false);
            $descriptionZh = ybb_sm_prepare_description_html((string) ($row['descriptionZh'] ?? ''));
            $descriptionJa = ybb_sm_prepare_description_html((string) ($row['descriptionJa'] ?? ''));
            $hideDescription = ybb_sm_parse_checkbox_enabled($row, 'hideDescription', false);
            $hideAdditionalInfo = ybb_sm_parse_checkbox_enabled($row, 'hideAdditionalInfo', false);
            $galleryEnabled = ybb_sm_parse_checkbox_enabled($row, 'galleryEnabled', true);
            $galleryOverrideEnabled = ybb_sm_parse_checkbox_enabled($row, 'galleryOverrideEnabled', false);
            $galleryDefaultIndex = max(0, (int) ($row['galleryDefaultIndex'] ?? 0));
            $galleryImagesRaw = $row['galleryImages'] ?? [];
            if (is_string($galleryImagesRaw)) {
                $galleryImagesRaw = preg_split('/[\r\n]+/', $galleryImagesRaw) ?: [];
            }
            if (!is_array($galleryImagesRaw)) {
                $galleryImagesRaw = [];
            }
            $galleryImages = array_values(array_filter(array_map(
                static fn ($url) => esc_url_raw(trim((string) $url)),
                $galleryImagesRaw
            )));
            $galleryHideIndexesRaw = $row['galleryHideIndexes'] ?? [];
            if (is_string($galleryHideIndexesRaw)) {
                $galleryHideIndexesRaw = preg_split('/[,\s]+/', $galleryHideIndexesRaw) ?: [];
            }
            if (!is_array($galleryHideIndexesRaw)) {
                $galleryHideIndexesRaw = [];
            }
            $galleryHideIndexes = array_values(array_unique(array_filter(array_map(
                static fn ($v) => max(0, (int) $v),
                $galleryHideIndexesRaw
            ), static fn ($v) => $v >= 0)));
            $sloganEn = ybb_sm_sanitize_slogan_text((string) ($row['sloganEn'] ?? ''));
            $sloganZh = ybb_sm_sanitize_slogan_text((string) ($row['sloganZh'] ?? ''));
            $sloganJa = ybb_sm_sanitize_slogan_text((string) ($row['sloganJa'] ?? ''));
            $hideSlogan = ybb_sm_parse_checkbox_enabled($row, 'hideSlogan', false);

            if (
                $titleZh === '' && $titleJa === '' && !$frontHidden
                && $descriptionZh === '' && $descriptionJa === ''
                && !$hideDescription && !$hideAdditionalInfo
                && $galleryEnabled && !$galleryOverrideEnabled && $galleryDefaultIndex === 0
                && $galleryImages === [] && $galleryHideIndexes === []
                && $sloganEn === '' && $sloganZh === '' && $sloganJa === ''
                && !$hideSlogan
            ) {
                unset($overrides[$handle]);
            } else {
                $overrides[$handle] = [
                    'titleZh' => $titleZh,
                    'titleJa' => $titleJa,
                    'frontHidden' => $frontHidden,
                    'descriptionZh' => $descriptionZh,
                    'descriptionJa' => $descriptionJa,
                    'hideDescription' => $hideDescription,
                    'hideAdditionalInfo' => $hideAdditionalInfo,
                    'galleryEnabled' => $galleryEnabled,
                    'galleryOverrideEnabled' => $galleryOverrideEnabled,
                    'galleryDefaultIndex' => $galleryDefaultIndex,
                    'galleryImages' => $galleryImages,
                    'galleryHideIndexes' => $galleryHideIndexes,
                    'sloganEn' => $sloganEn,
                    'sloganZh' => $sloganZh,
                    'sloganJa' => $sloganJa,
                    'hideSlogan' => $hideSlogan,
                    'updatedAt' => gmdate('c'),
                ];
            }
        }
    }

    $productIndex = is_array($existing['productIndex'] ?? null)
        ? $existing['productIndex']
        : ($defaults['productIndex'] ?? []);

    $pdp = function_exists('ybb_sm_sanitize_pdp')
        ? ybb_sm_sanitize_pdp($input['pdp'] ?? null, is_array($existing['pdp'] ?? null) ? $existing['pdp'] : [])
        : (is_array($existing['pdp'] ?? null) ? $existing['pdp'] : ($defaults['pdp'] ?? []));

    ybb_sm_product_overrides_save($overrides);

    return [
        'enabled' => ybb_sm_parse_checkbox_enabled($input, 'enabled', !empty($existing['enabled'])),
        'productIndex' => $productIndex,
        'pdp' => $pdp,
    ];
}

function ybb_sm_sanitize_deploy_admin($input, array $existing): array
{
    if (!is_array($input)) {
        return $existing;
    }

    $secret = trim((string) ($input['secret'] ?? ''));
    if ($secret === '') {
        $secret = (string) ($existing['secret'] ?? '');
    }
    if ($secret === '') {
        $secret = wp_generate_password(32, false, false);
    }

    return array_replace($existing, ['secret' => $secret]);
}
