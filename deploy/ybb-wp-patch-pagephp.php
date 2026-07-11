<?php
/**
 * One-shot: patch page.php encoding corruption via web filesystem.
 * ?key=ybb-migrate-20260624
 */
header('Content-Type: text/plain; charset=utf-8');
if (($_GET['key'] ?? '') !== 'ybb-migrate-20260624') {
    http_response_code(403);
    exit("forbidden\n");
}

$target = __DIR__ . '/wp-content/mu-plugins/ybb-site-manager/includes/admin/page.php';
$payload = __DIR__ . '/ybb-page-php-patch.b64';
if (!is_readable($payload)) {
    http_response_code(404);
    exit("missing payload: ybb-page-php-patch.b64\n");
}

$raw = base64_decode((string) file_get_contents($payload), true);
if ($raw === false || $raw === '') {
    http_response_code(400);
    exit("bad payload\n");
}

$bak = $target . '.bak-' . gmdate('Ymd-His');
if (!@copy($target, $bak)) {
    http_response_code(500);
    exit("backup failed\n");
}

$ok = file_put_contents($target, $raw, LOCK_EX);
if ($ok === false) {
    http_response_code(500);
    exit("write failed\n");
}

if (function_exists('opcache_invalidate')) {
    opcache_invalidate($target, true);
    if (function_exists('opcache_reset')) {
        @opcache_reset();
    }
}

echo "patched\n";
echo "backup=$bak\n";
echo "size=$ok\n";
echo "mtime=" . date('c', filemtime($target)) . "\n";

// quick parse check
try {
    token_get_all($raw, TOKEN_PARSE);
    echo "token_parse OK\n";
} catch (ParseError $e) {
    echo "parse_error: " . $e->getMessage() . " @ " . $e->getLine() . "\n";
    exit(1);
}
