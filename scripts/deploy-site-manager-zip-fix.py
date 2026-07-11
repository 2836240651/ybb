#!/usr/bin/env python3
"""Upload site-manager zip + unzip trigger (atomic fix for corrupt mu-plugins)."""
from __future__ import annotations

import subprocess
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from deploy_ftps import _upload_file, connect_ftps, load_secrets

ROOT = Path(__file__).resolve().parents[1]
ZIP = ROOT / "deploy/wp-content/mu-plugins/ybb-site-manager-product-live-patch.zip"
UNZIP = ROOT / "deploy/unzip-site-manager-patch.php"


def main() -> int:
    if not ZIP.is_file():
        print("run pack-ybb-site-manager-full.py first", file=sys.stderr)
        return 1

    ftp = load_secrets()["ftp"]
    remote = ftp["remoteRoot"].rstrip("/")
    uploads = [
        (ZIP, "wp-content/mu-plugins/ybb-site-manager-product-live-patch.zip"),
        (UNZIP, "unzip-site-manager-patch.php"),
    ]

    client = None
    for local, rel in uploads:
        for attempt in range(1, 5):
            try:
                if client is None:
                    client = connect_ftps(ftp)
                print(f"[upload] {rel} ({local.stat().st_size}b)")
                _upload_file(client, remote, local, rel)
                break
            except Exception as exc:
                print(f"[retry] {rel} {attempt}: {exc!r}")
                try:
                    client.quit()
                except Exception:
                    pass
                client = None
                time.sleep(2)
        else:
            return 1

    if client:
        client.quit()

    print("[curl] triggering unzip on deploy machine...")
    proc = subprocess.run(
        [
            "ssh",
            "hermes-modx",
            "curl -sS 'https://carp-ybb.com/unzip-site-manager-patch.php'",
        ],
        capture_output=True,
        text=True,
        timeout=120,
    )
    print(proc.stdout)
    if proc.stderr:
        print(proc.stderr, file=sys.stderr)
    return 0 if proc.returncode == 0 and "extracted" in proc.stdout else 1


if __name__ == "__main__":
    sys.exit(main())
