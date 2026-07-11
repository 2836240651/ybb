<?php
header('Content-Type: text/plain; charset=utf-8');
if (($_GET['key'] ?? '') !== 'ybb-migrate-20260624') { http_response_code(403); exit("forbidden\n"); }
$target = __DIR__ . '/wp-content/mu-plugins/ybb-site-manager/includes/admin/tab-audit.php';
$raw = base64_decode((string) file_get_contents(__DIR__ . '/ybb-tab-audit-patch.b64'), true);
if ($raw === false || $raw === '') { exit("bad b64\n"); }
file_put_contents($target, $raw, LOCK_EX);
if (function_exists('opcache_invalidate')) { opcache_invalidate($target, true); @opcache_reset(); }
echo 'size=' . strlen($raw) . "\n";
try { token_get_all($raw, TOKEN_PARSE); echo "OK\n"; }
catch (ParseError $e) { echo $e->getMessage() . ' @ ' . $e->getLine() . "\n"; exit(1); }
