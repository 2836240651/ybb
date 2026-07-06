#!/usr/bin/env python3
"""DEPRECATED �?emergency FTPS upload of homepage chunks.

DO NOT use as default. Prefer SiteGround browser:
  node scripts/open-siteground-chrome.mjs
  node scripts/upload-siteground-browser.mjs --files out/index.html ... --wait-manual
  py scripts/verify-remote-deploy.py

FTPS EOFError has produced 0-byte index.html on production.
"""
from __future__ import annotations

import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from deploy_ftps import load_secrets, upload_file

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "out"

FILES = [
    "index.html",
    "_next/static/chunks/b0d5f4df8ab44d3b.css",
    "_next/static/chunks/46d0514b3d5fba46.js",
    "_next/static/chunks/7fdf92de9b174696.js",
    "_next/static/chunks/ff65165468c43a65.js",
    "_next/static/chunks/33e365abee1688f8.js",
    "_next/static/chunks/235d6bf3a14b5b25.js",
    "_next/static/chunks/88a50a3d901aa33b.js",
    "_next/static/chunks/91adb7bdb9870c6a.js",
    "_next/static/chunks/8082ab48faca5ea1.js",
    "_next/static/chunks/7fca0877b5c0c0d1.js",
    "_next/static/chunks/e02c6fbb43412519.css",
    "_next/static/chunks/turbopack-e5d16c87b5167b7e.js",
]


def main() -> int:
    ftp = load_secrets()["ftp"]
    remote = ftp["remoteRoot"].rstrip("/")

    for rel in FILES:
        local = OUT / Path(rel)
        if not local.is_file():
            print(f"[skip] missing {rel}")
            continue
        rel_posix = rel.replace("\\", "/")
        ok = False
        for attempt in range(1, 6):
            try:
                print(f"[upload] {rel_posix} ({local.stat().st_size} bytes) attempt {attempt}")
                upload_file(ftp, remote, local, rel_posix)
                ok = True
                break
            except Exception as exc:
                print(f"[retry] {rel_posix}: {exc!r}")
                time.sleep(3)
        if not ok:
            return 1

    print("[upload-critical-chunks] done")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
