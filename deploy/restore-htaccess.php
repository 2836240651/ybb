<?php
// One-time: restore public_html/.htaccess from htaccess.restore (browser upload path).
// Delete restore-htaccess.php + htaccess.restore after success.
header('Content-Type: text/plain; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
set_time_limit(120);

$key = $_GET['key'] ?? '';
if ($key !== 'ybb-migrate-20260624') {
    http_response_code(403);
    echo "forbidden\n";
    exit(1);
}

$src = __DIR__ . '/htaccess.restore';
$dest = __DIR__ . '/.htaccess';
if (!is_file($src)) {
    http_response_code(404);
    echo "missing htaccess.restore\n";
    exit(1);
}

$data = file_get_contents($src);
if ($data === false || $data === '') {
    http_response_code(500);
    echo "read failed\n";
    exit(1);
}
echo "source " . basename($src) . " bytes: " . strlen($data) . "\n";

$backup = __DIR__ . '/.htaccess.bak.' . gmdate('Ymd-His');
if (is_file($dest)) {
    copy($dest, $backup);
}

if (file_put_contents($dest, $data) === false) {
    http_response_code(500);
    echo "write failed\n";
    exit(1);
}

echo "restored .htaccess (" . strlen($data) . " bytes)\n";
if (is_file($backup)) {
    echo "backup: " . basename($backup) . "\n";
}
echo "next: purge SiteGround cache, then delete restore-htaccess.php and htaccess.restore\n";
