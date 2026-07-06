#!/usr/bin/env python3
"""FTPS upload minimal PRI patch (same files as ybb-reviews-import-patch.zip)."""
from __future__ import annotations

import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from deploy_ftps import _upload_file, connect_ftps, load_secrets

ROOT = Path(__file__).resolve().parents[1]
MU = ROOT / "deploy" / "wp-content" / "mu-plugins"

UPLOADS: list[tuple[Path, str]] = [
    (MU / "ybb-product-reviews.php", "wp-content/mu-plugins/ybb-product-reviews.php"),
    (
        MU / "ybb-site-manager/includes/admin/page.php",
        "wp-content/mu-plugins/ybb-site-manager/includes/admin/page.php",
    ),
    (
        MU / "ybb-site-manager/includes/modules/audit-log.php",
        "wp-content/mu-plugins/ybb-site-manager/includes/modules/audit-log.php",
    ),
]


def _iter_pr_dir() -> list[tuple[Path, str]]:
    out: list[tuple[Path, str]] = []
    base = MU / "ybb-product-reviews"
    for path in sorted(base.rglob("*")):
        if path.is_file():
            rel = path.relative_to(MU).as_posix()
            out.append((path, rel))
    return out


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
    ftp = load_secrets()["ftp"]
    remote = ftp["remoteRoot"].rstrip("/")
    uploads = list(UPLOADS) + _iter_pr_dir()

    missing = [str(p) for p, _ in uploads if not p.is_file()]
    if missing:
        print("[error] missing:", ", ".join(missing))
        return 1

    client = None
    for local, rel in uploads:
        for attempt in range(1, 4):
            try:
                if client is None:
                    client = connect_ftps(ftp)
                print(f"[upload] {rel} ({local.stat().st_size} bytes)")
                _upload_file(client, remote, local, rel)
                break
            except Exception as exc:
                print(f"[retry] {rel} attempt {attempt}: {exc!r}")
                _close(client)
                client = None
                time.sleep(2)
        else:
            return 1

    _close(client)
    print("[upload-reviews-import-patch] done �?verify WP �?YBB 站点管理 �?评价导入")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
