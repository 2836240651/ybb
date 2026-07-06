<?php
// One-time: copy YBB mu-plugins from upload payloads (no stale inline hydrate).
// Upload deploy/wp-content/mu-plugins/*.upload.php siblings to public_html first, OR
// upload this file + payloads, then visit: /update-ybb-home-mu.php?key=ybb-home-20260625
header('Content-Type: text/plain; charset=utf-8');
$key = $_GET['key'] ?? '';
if ($key !== 'ybb-home-20260625') {
    http_response_code(403);
    exit('forbidden');
}
$dir = __DIR__ . '/wp-content/mu-plugins';
if (!is_dir($dir) && !mkdir($dir, 0755, true) && !is_dir($dir)) {
    exit('cannot create mu-plugins');
}
$files = [
    'ybb-home-settings.php' => __DIR__ . '/ybb-home-settings.upload.php',
    'ybb-latest-stories-hydrate.php' => __DIR__ . '/ybb-latest-stories-hydrate.upload.php',
    'ybb-hot-products-hydrate.php' => __DIR__ . '/ybb-hot-products-hydrate.upload.php',
];
foreach ($files as $name => $src) {
    if (!is_readable($src)) {
        exit("missing upload payload: $name\n");
    }
    $dst = $dir . '/' . $name;
    $bak = $dst . '.bak-' . date('Ymd-His');
    if (is_file($dst)) {
        copy($dst, $bak);
        echo "backup $name -> " . basename($bak) . "\n";
    }
    if (!copy($src, $dst)) {
        exit("copy failed: $name\n");
    }
    echo "updated $name\n";
}
echo "done\n";
