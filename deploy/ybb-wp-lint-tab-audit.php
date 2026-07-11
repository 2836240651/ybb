<?php
header('Content-Type: text/plain; charset=utf-8');
if (($_GET['key'] ?? '') !== 'ybb-migrate-20260624') { http_response_code(403); exit; }
$f = __DIR__ . '/wp-content/mu-plugins/ybb-site-manager/includes/admin/tab-audit.php';
$lines = file($f);
for ($i = 92; $i <= 98; $i++) {
    echo $i . ': ' . bin2hex($lines[$i-1]) . "\n";
}
try {
    token_get_all(file_get_contents($f), TOKEN_PARSE);
    echo "OK\n";
} catch (ParseError $e) {
    echo $e->getMessage() . ' @ ' . $e->getLine() . "\n";
}
