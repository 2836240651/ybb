#!/usr/bin/env python3
"""DEPRECATED �?emergency FTPS upload of index.html only.

DO NOT use as default. Prefer SiteGround browser (see docs/siteground-browser-deploy.md).
FTPS interrupt has produced 0-byte index.html on production.
"""
from __future__ import annotations

import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from deploy_ftps import _upload_file, connect_ftps, load_secrets

ROOT = Path(__file__).resolve().parents[1]
INDEX = ROOT / "out" / "index.html"


def main() -> int:
    if not INDEX.is_file():
        print(f"missing {INDEX} �?run build-static.ps1 first")
        return 1

    ftp = load_secrets()["ftp"]
    remote = ftp["remoteRoot"].rstrip("/")
    client = None
    for attempt in range(1, 4):
        try:
            if client is None:
                client = connect_ftps(ftp)
            print(f"[upload] index.html ({INDEX.stat().st_size} bytes)")
            _upload_file(client, remote, INDEX, "index.html")
            break
        except Exception as exc:
            print(f"[retry] attempt {attempt}: {exc!r}")
            if client:
                try:
                    client.quit()
                except Exception:
                    pass
            client = None
            time.sleep(2)
    else:
        return 1

    if client:
        try:
            client.quit()
        except Exception:
            pass

    print("[publish-home-index] done")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
