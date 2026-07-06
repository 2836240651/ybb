<?php
// One-time: ensure Latest Stories + Hot Products hydrate scripts in index.html
// Visit: /patch-index-home-hydrate.php?key=ybb-home-20260625
header('Content-Type: text/plain; charset=utf-8');
$key = $_GET['key'] ?? '';
if ($key !== 'ybb-home-20260625') {
    http_response_code(403);
    exit('forbidden');
}
$index = __DIR__ . '/index.html';
if (!is_readable($index)) {
    exit('missing index.html');
}
$html = file_get_contents($index);
$scripts = [
    'ybb-latest-stories-hydrate' => '<script defer src="/index.php?rest_route=/ybb/v1/latest-stories-hydrate.js" id="ybb-latest-stories-hydrate"></script>',
    'ybb-hot-products-hydrate' => '<script defer src="/index.php?rest_route=/ybb/v1/hot-products-hydrate.js" id="ybb-hot-products-hydrate"></script>',
];
$changed = false;
foreach ($scripts as $marker => $tag) {
    if (str_contains($html, $marker)) {
        echo "skip $marker (already present)\n";
        continue;
    }
    $pos = strripos($html, '</body>');
    if ($pos === false) {
        exit('no </body>');
    }
    $html = substr($html, 0, $pos) . $tag . substr($html, $pos);
    $changed = true;
    echo "added $marker\n";
}
if ($changed) {
    $bak = $index . '.bak-hydrate-' . date('Ymd-His');
    copy($index, $bak);
    file_put_contents($index, $html);
    echo "backup: $bak\n";
}
echo "done\n";
