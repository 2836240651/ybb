#!/usr/bin/env python3
"""Upload fixed mu-plugin PHP files via dedicated b64 patchers (FTPS root only)."""
from __future__ import annotations

import base64
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from deploy_ftps import connect_ftps, load_secrets, _upload_file

ROOT = Path(__file__).resolve().parents[1]
KEY = "ybb-migrate-20260624"

TARGETS = [
  "wp-content/mu-plugins/ybb-site-manager/includes/admin/tab-audit.php",
  "wp-content/mu-plugins/ybb-site-manager/includes/admin/page.php",
  "wp-content/mu-plugins/ybb-site-manager/includes/modules/audit-log.php",
  "wp-content/mu-plugins/ybb-site-manager/ybb-site-manager.php",
]


def patcher_php(rel: str, b64_name: str) -> str:
    return f"""<?php
header('Content-Type: text/plain; charset=utf-8');
if (($_GET['key'] ?? '') !== '{KEY}') {{ http_response_code(403); exit("forbidden\\n"); }}
$target = __DIR__ . '/{rel}';
$raw = base64_decode((string) file_get_contents(__DIR__ . '/{b64_name}'), true);
if ($raw === false || $raw === '') {{ exit("bad b64\\n"); }}
file_put_contents($target, $raw, LOCK_EX);
if (function_exists('opcache_invalidate')) {{ opcache_invalidate($target, true); @opcache_reset(); }}
echo $target . "\\nsize=" . strlen($raw) . "\\n";
try {{ token_get_all($raw, TOKEN_PARSE); echo "OK\\n"; }}
catch (ParseError $e) {{ echo $e->getMessage() . ' @ ' . $e->getLine() . "\\n"; exit(1); }}
"""


def main() -> int:
    secrets = load_secrets()
    ftp = secrets["ftp"]
    root = ftp.get("remoteRoot", "").rstrip("/")
    client = connect_ftps(ftp)
    try:
        for i, rel in enumerate(TARGETS):
            local = ROOT / "deploy" / rel
            if not local.is_file():
                print("missing", local, file=sys.stderr)
                return 1
            tag = rel.split("/")[-1].replace(".", "_")
            b64_name = f"ybb-batch-{tag}-{i}.b64"
            php_name = f"ybb-batch-patch-{tag}-{i}.php"
            (ROOT / "deploy" / b64_name).write_text(
                base64.b64encode(local.read_bytes()).decode("ascii"), encoding="ascii"
            )
            (ROOT / "deploy" / php_name).write_text(patcher_php(rel, b64_name), encoding="utf-8")
            for name in (b64_name, php_name):
                _upload_file(client, root, ROOT / "deploy" / name, name)
            client.quit()
            client = connect_ftps(ftp)
            url = f"https://carp-ybb.com/{php_name}?key={KEY}"
            r = subprocess.run(["curl.exe", "-fsS", url], capture_output=True, text=True)
            print(r.stdout.strip())
            if r.returncode:
                print(r.stderr, file=sys.stderr)
                return r.returncode
    finally:
        client.quit()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
