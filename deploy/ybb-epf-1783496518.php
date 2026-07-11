<?php
header('Content-Type: text/plain; charset=utf-8');
if ((\['key'] ?? '') !== 'ybb-migrate-20260624') { http_response_code(403); exit('forbidden\n'); }
\=__DIR__ . '/wp-content/mu-plugins/ybb-editpost-fatal-capture.php';
\=base64_decode((string)file_get_contents(__DIR__ . '/ybb-epf-1783496518.b64'), true);
if (\===false||\==='') { exit('bad b64\n'); }
file_put_contents(\,\,LOCK_EX);
if (function_exists('opcache_invalidate')) { opcache_invalidate(\,true); @opcache_reset(); }
echo 'patched wp-content/mu-plugins/ybb-editpost-fatal-capture.php\nsize=' . strlen(\) . '\n';
try { token_get_all(\, TOKEN_PARSE); echo 'token_parse OK\n'; } catch (ParseError \) { echo 'parse_error: '.\->getMessage().' @ '.\->getLine().'\n'; exit(1); }
