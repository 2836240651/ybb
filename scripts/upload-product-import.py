#!/usr/bin/env python3
"""Upload product-import/ + WC migration PHP to public_html."""
from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from deploy_ftps import _upload_file, connect_ftps, load_secrets

ROOT = Path(__file__).resolve().parents[1]
IMPORT_DIR = ROOT / "deploy" / "product-import"

# Woo sync only reads manifest + wc-catalog (+ optional wc-id-map on server).
ESSENTIAL_IMPORT = {
    "manifest.json",
    "wc-catalog.json",
    "wc-id-map.json",
}


def _close_client(client) -> None:
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
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--full",
        action="store_true",
        help="Upload entire product-import tree (images, audits, etc.)",
    )
    args = parser.parse_args()

    ftp = load_secrets()["ftp"]
    remote = ftp["remoteRoot"].rstrip("/")

    uploads: list[tuple[Path, str]] = [
        (ROOT / "deploy/sync-wc-products.php", "sync-wc-products.php"),
        (ROOT / "deploy/wc-cleanup-products.php", "wc-cleanup-products.php"),
        (ROOT / "deploy/wc-product-type-audit.php", "wc-product-type-audit.php"),
        (ROOT / "deploy/sync-wc-hot-products.php", "sync-wc-hot-products.php"),
        (ROOT / "lib/data/hot-products.json", "hot-products.json"),
    ]

    if args.full:
        for path in sorted(IMPORT_DIR.rglob("*")):
            if path.is_file():
                rel = path.relative_to(IMPORT_DIR).as_posix()
                uploads.append((path, f"product-import/{rel}"))
    else:
        for name in sorted(ESSENTIAL_IMPORT):
            path = IMPORT_DIR / name
            if path.is_file():
                uploads.append((path, f"product-import/{name}"))

    client = None
    try:
        for i, (local, remote_rel) in enumerate(uploads, 1):
            for attempt in range(1, 4):
                try:
                    if client is None:
                        client = connect_ftps(ftp)
                    print(f"[upload] ({i}/{len(uploads)}) {remote_rel} ({local.stat().st_size} bytes)")
                    _upload_file(client, remote, local, remote_rel)
                    break
                except Exception as exc:
                    print(f"[retry] {remote_rel} attempt {attempt}: {exc!r}")
                    _close_client(client)
                    client = None
                    if attempt >= 3:
                        raise
                    time.sleep(5)
    finally:
        _close_client(client)

    print(f"[upload-product-import] OK ({len(uploads)} files)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
