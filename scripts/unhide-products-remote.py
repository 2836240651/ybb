#!/usr/bin/env python3
"""FTPS upload ybb-unhide-products.php and unhide catalog handles."""
from __future__ import annotations

import json
import sys
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

from deploy_ftps import _upload_file, connect_ftps, load_secrets

HANDLES = [
    "tz-eldz-001",
    "tz-eldz-002",
    "tz-qzdz-001",
    "tz-qzdz-002",
    "tz-qzdz-003",
    "tz-qz-010",
    "tz-qz-011",
]


def main() -> int:
    handles = ",".join(HANDLES)
    php = ROOT / "deploy/ybb-unhide-products.php"
    if not php.is_file():
        print("missing deploy/ybb-unhide-products.php", file=sys.stderr)
        return 1

    ftp = load_secrets()["ftp"]
    root = ftp["remoteRoot"]
    client = connect_ftps(ftp)
    _upload_file(client, root, php, "ybb-unhide-products.php")
    client.quit()
    print("[unhide] uploaded ybb-unhide-products.php")

    for dry_run in (True, False):
        qs = f"key=ybb-migrate-20260624&handles={handles}&_={int(time.time() * 1000)}"
        if dry_run:
            qs += "&dry_run=1"
        url = f"https://carp-ybb.com/ybb-unhide-products.php?{qs}"
        req = urllib.request.Request(url, headers={"User-Agent": "ybb-unhide/1"})
        with urllib.request.urlopen(req, timeout=90) as resp:
            body = resp.read().decode()
        print(f"[unhide] dry_run={dry_run} HTTP {resp.status}")
        print(body)

    return 0


if __name__ == "__main__":
    sys.exit(main())
