<?php
header('Content-Type: text/plain; charset=utf-8');
if (($_GET['key'] ?? '') !== 'ybb-migrate-20260624') { http_response_code(403); exit("forbidden\n"); }
$rel = <<<'REL'
wp-content/mu-plugins/ybb-site-manager/includes/modules/home.php
REL;
$target = __DIR__ . '/' . $rel;
$payload = __DIR__ . '/ybb-patch-wp-content__mu-plugins__ybb-site-manager__includes__modules__home_php-20260709171232.b64';
if (!is_readable($payload)) { http_response_code(404); exit("missing payload\n"); }
$raw = base64_decode((string) file_get_contents($payload), true);
if ($raw === false || $raw === '') { http_response_code(400); exit("bad payload\n"); }
$bak = $target . '.bak-' . gmdate('Ymd-His');
@copy($target, $bak);
$ok = file_put_contents($target, $raw, LOCK_EX);
if ($ok === false) { http_response_code(500); exit("write failed\n"); }
if (function_exists('opcache_invalidate')) { opcache_invalidate($target, true); @opcache_reset(); }
echo "patched $rel\nsize=$ok\n";
try { token_get_all($raw, TOKEN_PARSE); echo "token_parse OK\n"; }
catch (ParseError $e) { echo "parse_error: ".$e->getMessage()." @ ".$e->getLine()."\n"; exit(1); }
