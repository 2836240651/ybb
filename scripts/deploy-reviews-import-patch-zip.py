#!/usr/bin/env python3
"""Deploy reviews-import mu-plugin patch via zip + unzip (minimal FTPS)."""
from __future__ import annotations

import subprocess
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

from siteground_deploy import trigger_php_url, upload_files_ftps  # noqa: E402

MU = ROOT / "deploy" / "wp-content" / "mu-plugins"
ZIP_PATH = ROOT / "deploy" / "ybb-reviews-import-patch.zip"
UNZIP_PHP = ROOT / "deploy" / "unzip-reviews-import-patch.php"
REMOTE_ZIP = "wp-content/mu-plugins/ybb-reviews-import-patch.zip"
REMOTE_UNZIP = "unzip-reviews-import-patch.php"


def pack_zip() -> None:
    files = [
        (MU / "ybb-product-reviews.php", "ybb-product-reviews.php"),
        (MU / "ybb-site-manager/includes/admin/page.php", "ybb-site-manager/includes/admin/page.php"),
        (MU / "ybb-site-manager/includes/modules/audit-log.php", "ybb-site-manager/includes/modules/audit-log.php"),
    ]
    pr = MU / "ybb-product-reviews"
    ZIP_PATH.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(ZIP_PATH, "w", zipfile.ZIP_DEFLATED) as zf:
        for local, arc in files:
            zf.write(local, arc)
        for path in sorted(pr.rglob("*")):
            if path.is_file():
                zf.write(path, "ybb-product-reviews/" + path.relative_to(pr).as_posix())
    print(f"[pack] {ZIP_PATH} ({ZIP_PATH.stat().st_size} bytes)")


def main() -> int:
    pack_zip()
    if not UNZIP_PHP.is_file():
        print("missing unzip php", file=sys.stderr)
        return 1

    print("[deploy] FTPS upload zip + unzip helper")
    upload_files_ftps(
        [
            (ZIP_PATH, REMOTE_ZIP),
            (UNZIP_PHP, REMOTE_UNZIP),
        ]
    )

    trigger_php_url(
        f"/{REMOTE_UNZIP}",
        "extracted",
        label="unzip-reviews-import-patch.php",
    )

    print("[deploy-reviews-import-patch-zip] OK — verify WP → YBB 站点管理 → 评价导入")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
