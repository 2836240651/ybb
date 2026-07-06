<?php
// One-time: inject Latest Stories hydrate script into index.html
// Visit: /patch-index-latest-stories.php?key=ybb-home-20260625
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
$marker = 'ybb-latest-stories-hydrate';
if (str_contains($html, $marker)) {
    exit("already patched ($marker)\n");
}
$script = '<script defer src="/index.php?rest_route=/ybb/v1/latest-stories-hydrate.js" id="ybb-latest-stories-hydrate"></script>';
$pos = strripos($html, '</body>');
if ($pos === false) {
    exit('no </body>');
}
$bak = $index . '.bak-' . date('Ymd-His');
copy($index, $bak);
$new = substr($html, 0, $pos) . $script . substr($html, $pos);
file_put_contents($index, $new);
echo "patched index.html\nbackup: $bak\n";
