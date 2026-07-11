#!/usr/bin/env python3
"""Upload entire ybb-site-manager mu-plugin tree (fix truncated/corrupt PHP on server)."""
from __future__ import annotations

import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from deploy_ftps import _upload_file, connect_ftps, cwd_to, ensure_remote_dir, load_secrets

ROOT = Path(__file__).resolve().parents[1]
SM = ROOT / "deploy/wp-content/mu-plugins/ybb-site-manager"


def main() -> int:
    files = sorted(p for p in SM.rglob("*") if p.is_file())
    ftp = load_secrets()["ftp"]
    remote_root = ftp["remoteRoot"].rstrip("/")
    base = "wp-content/mu-plugins/ybb-site-manager"
    client = None

    for local in files:
        rel = f"{base}/{local.relative_to(SM).as_posix()}"
        for attempt in range(1, 5):
            try:
                if client is None:
                    client = connect_ftps(ftp)
                print(f"[upload] {rel} ({local.stat().st_size}b)")
                _upload_file(client, remote_root, local, rel)
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
    print(f"[done] {len(files)} files")
    return 0


if __name__ == "__main__":
    sys.exit(main())
