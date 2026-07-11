#!/usr/bin/env python3
"""Upload YBB mu-plugins to wp-content/mu-plugins/.

PREFERRED: SiteGround File Manager via browser �?  node scripts/open-siteground-chrome.mjs
  node scripts/upload-siteground-browser.mjs --files deploy/wp-content/mu-plugins/<file>.php --wait-manual

This FTPS script is EMERGENCY BACKUP ONLY (same EOFError risk as deploy_ftps.py).
"""
from __future__ import annotations

import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from deploy_ftps import _upload_file, connect_ftps, load_secrets

ROOT = Path(__file__).resolve().parents[1]
MU_DIR = ROOT / "deploy" / "wp-content" / "mu-plugins"

FILES = [
    "ybb-site-manager-loader.php",
    "ybb-site-brand.php",
    "ybb-home-settings.php",
    "ybb-latest-stories-hydrate.php",
    "ybb-hot-products-hydrate.php",
    "ybb-contact-inquiry.php",
    "ybb-quorlyx-embed.php",
    "ybb-product-reviews.php",
    "ybb-locale.php",
    "ybb-fix-airwallex-redirect.php",
    "ybb-fix-wc-account.php",
]

DIRS = [
    "ybb-product-reviews",
    "ybb-my-account",
    "ybb-flat-checkout",
]


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


def _iter_dir_files(local_dir: Path) -> list[tuple[Path, str]]:
    out: list[tuple[Path, str]] = []
    for path in sorted(local_dir.rglob("*")):
        if not path.is_file():
            continue
        rel = path.relative_to(MU_DIR).as_posix()
        out.append((path, f"wp-content/mu-plugins/{rel}"))
    return out


def main() -> int:
    ftp = load_secrets()["ftp"]
    remote = ftp["remoteRoot"].rstrip("/")
    uploads: list[tuple[Path, str]] = [(MU_DIR / name, f"wp-content/mu-plugins/{name}") for name in FILES]

    for dir_name in DIRS:
        local_dir = MU_DIR / dir_name
        if local_dir.is_dir():
            uploads.extend(_iter_dir_files(local_dir))

    client = None
    for local, rel in uploads:
        if not local.is_file():
            print(f"[skip] missing {local}")
            continue
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
    print("[upload-mu-plugins] done")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
