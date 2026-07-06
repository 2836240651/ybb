#!/usr/bin/env python3
"""Download selected mu-plugin files from production via FTPS.

This is a safety tool to recover files if a local patch went wrong.
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from deploy_ftps import connect_ftps, load_secrets  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]

FILES: list[tuple[str, Path]] = [
    (
        "wp-content/mu-plugins/ybb-site-manager/includes/class-rest.php",
        ROOT / "deploy/wp-content/mu-plugins/ybb-site-manager/includes/class-rest.php",
    ),
    (
        "wp-content/mu-plugins/ybb-site-manager/includes/modules/products.php",
        ROOT / "deploy/wp-content/mu-plugins/ybb-site-manager/includes/modules/products.php",
    ),
]


def main() -> int:
    ftp = load_secrets()["ftp"]
    remote_root = ftp["remoteRoot"].rstrip("/")
    client = None
    try:
        client = connect_ftps(ftp)
        for remote_rel, local_path in FILES:
            local_path.parent.mkdir(parents=True, exist_ok=True)
            remote_dir, remote_name = remote_rel.rsplit("/", 1)
            attempts = 3
            for attempt in range(1, attempts + 1):
                try:
                    client.cwd(f"{remote_root}/{remote_dir}".replace("//", "/"))
                    with local_path.open("wb") as f:
                        client.retrbinary(f"RETR {remote_name}", f.write)
                    print(f"[download] {remote_rel} -> {local_path}")
                    break
                except (EOFError, OSError) as exc:
                    if attempt >= attempts:
                        raise
                    print(f"[retry] {remote_rel} attempt {attempt}/{attempts}: {exc!r}")
                    try:
                        client.close()
                    except Exception:
                        pass
                    client = connect_ftps(ftp)
    finally:
        if client is not None:
            try:
                client.quit()
            except Exception:
                pass
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

