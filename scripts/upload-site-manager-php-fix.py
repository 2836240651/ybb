#!/usr/bin/env python3
"""Re-upload corrupted ybb-site-manager PHP files (fix wp-admin critical error)."""
from __future__ import annotations

import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from deploy_ftps import _upload_file, connect_ftps, load_secrets

ROOT = Path(__file__).resolve().parents[1]
MU = ROOT / "deploy/wp-content/mu-plugins"

FILES = [
    "ybb-site-manager/ybb-site-manager.php",
    "ybb-site-manager/includes/modules/products.php",
    "ybb-site-manager/includes/modules/audit-log.php",
    "ybb-site-manager/includes/class-rest.php",
    "ybb-site-manager/includes/class-sanitize.php",
    "ybb-site-manager/includes/admin/tab-products.php",
    "ybb-site-manager/includes/admin/page.php",
]


def main() -> int:
    ftp = load_secrets()["ftp"]
    remote = ftp["remoteRoot"].rstrip("/")
    client = None
    for rel in FILES:
        local = MU / rel.replace("/", "\\") if False else MU / Path(rel)
        local = MU / rel
        if not local.is_file():
            print(f"missing {local}", file=sys.stderr)
            return 1
        dest = f"wp-content/mu-plugins/{rel}"
        for attempt in range(1, 5):
            try:
                if client is None:
                    client = connect_ftps(ftp)
                print(f"[upload] {dest}")
                _upload_file(client, remote, local, dest)
                break
            except Exception as exc:
                print(f"[retry] {dest} {attempt}: {exc!r}")
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
    print("[fix] done")
    return 0


if __name__ == "__main__":
    sys.exit(main())
