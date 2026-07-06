#!/usr/bin/env python3
"""Upload YBB my-account mu-plugin to wp-content/mu-plugins/."""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from deploy_ftps import _upload_file, connect_ftps, load_secrets

ROOT = Path(__file__).resolve().parents[1]
MU_ROOT = ROOT / "deploy" / "wp-content" / "mu-plugins"
PLUGIN_DIR = MU_ROOT / "ybb-my-account"
LOADER = MU_ROOT / "ybb-my-account.php"


def _close(client) -> None:
    if client is None:
        return
    try:
        client.quit()
    except Exception:
        try:
            client.close()
        except Exception:
            pass


def main() -> int:
    if not LOADER.is_file() or not PLUGIN_DIR.is_dir():
        print("[error] my-account files missing under deploy/wp-content/mu-plugins/")
        return 1

    ftp = load_secrets()["ftp"]
    remote = ftp["remoteRoot"].rstrip("/")
    uploads: list[tuple[Path, str]] = [
        (ROOT / "deploy" / "wp-content" / "mu-plugins" / "ybb-locale.php", "wp-content/mu-plugins/ybb-locale.php"),
        (LOADER, "wp-content/mu-plugins/ybb-my-account.php"),
    ]
    for path in sorted(PLUGIN_DIR.rglob("*")):
        if path.is_file():
            rel = path.relative_to(MU_ROOT).as_posix()
            uploads.append((path, f"wp-content/mu-plugins/{rel}"))

    client = None
    for local, rel in uploads:
        try:
            if client is None:
                client = connect_ftps(ftp)
            print(f"[upload] {rel} ({local.stat().st_size} bytes)")
            _upload_file(client, remote, local, rel)
        except Exception as exc:
            print(f"[error] {rel}: {exc!r}")
            _close(client)
            return 1

    _close(client)
    print(f"[upload-my-account] done ({len(uploads)} files)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
