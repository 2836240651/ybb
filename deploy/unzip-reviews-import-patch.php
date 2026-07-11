<?php
// One-time: extract reviews-import mu-plugin patch zip. Delete after use.
header('Content-Type: text/plain; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
set_time_limit(120);

$muRoot = __DIR__ . '/wp-content/mu-plugins';
$zipPath = $muRoot . '/ybb-reviews-import-patch.zip';
if (!is_file($zipPath)) {
    http_response_code(404);
    echo "missing zip\n";
    exit(1);
}

$zip = new ZipArchive();
if ($zip->open($zipPath) !== true) {
    http_response_code(500);
    echo "open failed\n";
    exit(1);
}

$written = 0;
for ($i = 0; $i < $zip->numFiles; $i++) {
    $stat = $zip->statIndex($i);
    $name = str_replace('\\', '/', $stat['name']);
    if ($name === '' || str_ends_with($name, '/')) {
        continue;
    }
    $target = $muRoot . '/' . $name;
    $dir = dirname($target);
    if (!is_dir($dir)) {
        mkdir($dir, 0755, true);
    }
    $data = $zip->getFromIndex($i);
    if ($data === false) {
        echo "read fail: $name\n";
        continue;
    }
    file_put_contents($target, $data);
    $written++;
}
$zip->close();

if (function_exists('opcache_invalidate')) {
    foreach (glob($muRoot . '/ybb-product-reviews/**/*.php') ?: [] as $php) {
        opcache_invalidate($php, true);
    }
    opcache_invalidate($muRoot . '/ybb-product-reviews.php', true);
    opcache_invalidate($muRoot . '/ybb-site-manager/includes/admin/page.php', true);
    if (function_exists('opcache_reset')) {
        @opcache_reset();
    }
}

echo "extracted $written files\n";
