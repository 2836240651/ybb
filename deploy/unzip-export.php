<?php
// One-time: extract zip with normalized forward-slash paths. Delete after use.
header('Content-Type: text/plain; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
set_time_limit(600);
$zipPath = __DIR__ . '/ybb-static-export.zip';
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
$root = __DIR__;
$written = 0;
$productHtmlInZip = [];
for ($i = 0; $i < $zip->numFiles; $i++) {
    $stat = $zip->statIndex($i);
    $name = str_replace('\\', '/', $stat['name']);
    if ($name === '' || str_ends_with($name, '/')) {
        continue;
    }
    if (preg_match('#^products/[^/]+\.html$#', $name)) {
        $productHtmlInZip[basename($name)] = true;
    }
    $target = $root . '/' . $name;
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

$removed = 0;
$productsDir = $root . '/products';
if (is_dir($productsDir)) {
    foreach (glob($productsDir . '/*.html') ?: [] as $path) {
        $base = basename($path);
        if (!isset($productHtmlInZip[$base])) {
            if (@unlink($path)) {
                $removed++;
                echo "removed stale $base\n";
            }
        }
    }
}

echo "extracted $written files\n";
echo "removed stale product html $removed\n";
