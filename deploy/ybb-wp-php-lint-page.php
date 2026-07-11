<?php
header('Content-Type: text/plain; charset=utf-8');
if (($_GET['key'] ?? '') !== 'ybb-migrate-20260624') { http_response_code(403); exit; }
$f = __DIR__ . '/wp-content/mu-plugins/ybb-site-manager/includes/admin/page.php';
$line = file($f)[58]; // line 59
echo 'line59_hex=' . bin2hex($line) . "\n";
$r = @shell_exec('php -l ' . escapeshellarg($f) . ' 2>&1');
echo $r ?: "no php cli\n";
// token_get_all parse check
$src = file_get_contents($f);
try {
    token_get_all($src, TOKEN_PARSE);
    echo "token_parse OK\n";
} catch (ParseError $e) {
    echo "parse_error: " . $e->getMessage() . " @ " . $e->getLine() . "\n";
}
