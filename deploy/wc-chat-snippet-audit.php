<?php
require __DIR__ . '/wp-load.php';
header('Content-Type: application/json; charset=utf-8');
if (($_GET['key'] ?? '') !== 'ybb-migrate-20260624') exit('{}');

$snippetPosts = get_posts([
    'post_type' => 'xyz_snippets',
    'post_status' => 'publish',
    'numberposts' => 50,
]);

$snippets = array_map(function ($p) {
    $content = $p->post_content ?? '';
    return [
        'id' => $p->ID,
        'title' => $p->post_title,
        'hasChat' => (bool) preg_match('/chat|tidio|crisp|tawk|whatsapp|messenger|intercom|gorgias|chatway|chaty|livechat/i', $content),
        'preview' => substr(strip_tags($content), 0, 200),
    ];
}, $snippetPosts);

echo json_encode([
    'aiAgentOptions' => get_option('sg_ai_studio', null),
    'angieActive' => is_plugin_active('angie/angie.php'),
    'insertHtmlSnippets' => $snippets,
    'jetpackModules' => class_exists('Jetpack') ? \Jetpack::get_active_modules() : [],
], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
