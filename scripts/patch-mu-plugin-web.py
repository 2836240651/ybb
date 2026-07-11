#!/usr/bin/env python3
"""Patch mu-plugin PHP files on production via web uploader (bypass broken FTPS path)."""
from __future__ import annotations

import argparse
import base64
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from deploy_ftps import connect_ftps, load_secrets, _upload_file

ROOT = Path(__file__).resolve().parents[1]
PATCHER = ROOT / "deploy/ybb-wp-patch-file.php"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("rel", help="relative path under deploy/, e.g. wp-content/mu-plugins/.../tab-audit.php")
    args = ap.parse_args()
    rel = args.rel.replace("\\", "/").lstrip("/")
    local = ROOT / "deploy" / rel
    if not local.is_file():
        print("missing", local, file=sys.stderr)
        return 1

    tag = rel.replace("/", "__").replace(".", "_")
    stamp = __import__("time").strftime("%Y%m%d%H%M%S")
    b64_name = f"ybb-patch-{tag}-{stamp}.b64"
    b64_path = ROOT / "deploy" / b64_name
    b64_path.write_text(base64.b64encode(local.read_bytes()).decode("ascii"), encoding="ascii")

    patcher_src = """<?php
header('Content-Type: text/plain; charset=utf-8');
if (($_GET['key'] ?? '') !== 'ybb-migrate-20260624') { http_response_code(403); exit("forbidden\\n"); }
$rel = <<<'REL'
__REL__
REL;
$target = __DIR__ . '/' . $rel;
$payload = __DIR__ . '/__B64__';
if (!is_readable($payload)) { http_response_code(404); exit("missing payload\\n"); }
$raw = base64_decode((string) file_get_contents($payload), true);
if ($raw === false || $raw === '') { http_response_code(400); exit("bad payload\\n"); }
$bak = $target . '.bak-' . gmdate('Ymd-His');
@copy($target, $bak);
$ok = file_put_contents($target, $raw, LOCK_EX);
if ($ok === false) { http_response_code(500); exit("write failed\\n"); }
if (function_exists('opcache_invalidate')) { opcache_invalidate($target, true); @opcache_reset(); }
echo "patched $rel\\nsize=$ok\\n";
try { token_get_all($raw, TOKEN_PARSE); echo "token_parse OK\\n"; }
catch (ParseError $e) { echo "parse_error: ".$e->getMessage()." @ ".$e->getLine()."\\n"; exit(1); }
"""
    patcher_src = patcher_src.replace("__REL__", rel).replace("__B64__", b64_name)
    patcher_path = ROOT / "deploy/ybb-wp-patch-file.php"
    patcher_path.write_text(patcher_src, encoding="utf-8")

    secrets = load_secrets()
    ftp = secrets["ftp"]
    client = connect_ftps(ftp)
    root = ftp.get("remoteRoot", "").rstrip("/")
    try:
        for name in [b64_name, "ybb-wp-patch-file.php"]:
            _upload_file(client, root, ROOT / "deploy" / name, name)
    finally:
        client.quit()

    import subprocess
    url = "https://carp-ybb.com/ybb-wp-patch-file.php?key=ybb-migrate-20260624"
    r = subprocess.run(["curl.exe", "-fsS", url], capture_output=True, text=True)
    print(r.stdout)
    if r.returncode != 0:
        print(r.stderr, file=sys.stderr)
        return r.returncode
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
