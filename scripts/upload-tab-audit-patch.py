#!/usr/bin/env python3
from __future__ import annotations

import base64
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from deploy_ftps import connect_ftps, load_secrets, _upload_file

ROOT = Path(__file__).resolve().parents[1]
LOCAL = ROOT / "deploy/wp-content/mu-plugins/ybb-site-manager/includes/admin/tab-audit.php"
B64 = ROOT / "deploy/ybb-tab-audit-patch.b64"
PATCHER = ROOT / "deploy/ybb-wp-patch-tab-audit.php"

PATCHER.write_text(
    """<?php
header('Content-Type: text/plain; charset=utf-8');
if (($_GET['key'] ?? '') !== 'ybb-migrate-20260624') { http_response_code(403); exit("forbidden\\n"); }
$target = __DIR__ . '/wp-content/mu-plugins/ybb-site-manager/includes/admin/tab-audit.php';
$raw = base64_decode((string) file_get_contents(__DIR__ . '/ybb-tab-audit-patch.b64'), true);
if ($raw === false || $raw === '') { exit("bad b64\\n"); }
file_put_contents($target, $raw, LOCK_EX);
if (function_exists('opcache_invalidate')) { opcache_invalidate($target, true); @opcache_reset(); }
echo 'size=' . strlen($raw) . "\\n";
try { token_get_all($raw, TOKEN_PARSE); echo "OK\\n"; }
catch (ParseError $e) { echo $e->getMessage() . ' @ ' . $e->getLine() . "\\n"; exit(1); }
""",
    encoding="utf-8",
)

raw = LOCAL.read_bytes()
print("local_bytes", len(raw))
B64.write_text(base64.b64encode(raw).decode("ascii"), encoding="ascii")

secrets = load_secrets()
ftp = secrets["ftp"]
client = connect_ftps(ftp)
root = ftp.get("remoteRoot", "").rstrip("/")
try:
    for name in ("ybb-tab-audit-patch.b64", "ybb-wp-patch-tab-audit.php"):
        _upload_file(client, root, ROOT / "deploy" / name, name)
finally:
    client.quit()

r = subprocess.run(
    ["curl.exe", "-fsS", "https://carp-ybb.com/ybb-wp-patch-tab-audit.php?key=ybb-migrate-20260624"],
    capture_output=True,
    text=True,
)
print(r.stdout)
if r.returncode:
    print(r.stderr, file=sys.stderr)
    raise SystemExit(r.returncode)
