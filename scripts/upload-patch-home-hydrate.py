#!/usr/bin/env python3
"""Upload home hydrate patch script and trigger index.html patch on production."""
from __future__ import annotations

import sys
import time
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from deploy_ftps import _upload_file, connect_ftps, load_secrets

ROOT = Path(__file__).resolve().parents[1]
PATCH = ROOT / "deploy" / "patch-index-home-hydrate.php"
PATCH_KEY = "ybb-home-20260625"
PATCH_URL = f"https://carp-ybb.com/patch-index-home-hydrate.php?key={PATCH_KEY}"


def main() -> int:
    if not PATCH.is_file():
        print(f"missing {PATCH}")
        return 1

    ftp = load_secrets()["ftp"]
    remote = ftp["remoteRoot"].rstrip("/")
    client = None
    for attempt in range(1, 4):
        try:
            if client is None:
                client = connect_ftps(ftp)
            print(f"[upload] patch-index-home-hydrate.php")
            _upload_file(client, remote, PATCH, "patch-index-home-hydrate.php")
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

    print(f"[trigger] {PATCH_URL}")
    try:
        with urllib.request.urlopen(PATCH_URL, timeout=30) as res:
            body = res.read().decode("utf-8", errors="replace")
            print(body.strip())
    except Exception as exc:
        print(f"[trigger-error] {exc!r}")
        return 1

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
