#!/usr/bin/env python3
"""Upload ybb-site-manager contact.php hotfix to SiteGround public_html."""
from __future__ import annotations

import base64
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from deploy_ftps import connect_ftps, load_secrets, _upload_file

ROOT = Path(__file__).resolve().parents[1]
KEY = "ybb-migrate-20260624"
REL = "wp-content/mu-plugins/ybb-site-manager/includes/modules/contact.php"


def main() -> int:
    local = ROOT / "deploy" / REL
    raw = local.read_bytes()
    digest = __import__("hashlib").sha256(raw).hexdigest()[:12]
    b64_name = f"ybb-contact-patch-{digest}.b64"
    php_name = f"ybb-contact-patch-{digest}.php"
    patcher = f"""<?php
header('Content-Type: text/plain; charset=utf-8');
if (($_GET['key'] ?? '') !== '{KEY}') {{ http_response_code(403); exit("forbidden\\n"); }}
$target = __DIR__ . '/{REL}';
$raw = base64_decode((string) file_get_contents(__DIR__ . '/{b64_name}'), true);
if ($raw === false || $raw === '') {{ exit("bad b64\\n"); }}
file_put_contents($target, $raw, LOCK_EX);
if (function_exists('opcache_invalidate')) {{ opcache_invalidate($target, true); @opcache_reset(); }}
echo $target . "\\nsize=" . strlen($raw) . "\\nOK\\n";
"""
    (ROOT / "deploy" / b64_name).write_text(
        base64.b64encode(raw).decode("ascii"), encoding="ascii"
    )
    (ROOT / "deploy" / php_name).write_text(patcher, encoding="utf-8")

    secrets = load_secrets()
    ftp = secrets["ftp"]
    root = ftp.get("remoteRoot", "").rstrip("/")
    client = connect_ftps(ftp)
    try:
        for name in (b64_name, php_name):
            _upload_file(client, root, ROOT / "deploy" / name, name)
    finally:
        client.quit()

    url = f"https://carp-ybb.com/{php_name}?key={KEY}"
    proc = subprocess.run(["curl.exe", "-fsS", url], capture_output=True, text=True)
    print(proc.stdout.strip())
    return proc.returncode


if __name__ == "__main__":
    raise SystemExit(main())
