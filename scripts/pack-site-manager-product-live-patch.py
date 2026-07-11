#!/usr/bin/env python3
"""Pack site-manager product-live patch for single zip upload."""
from __future__ import annotations

import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MU = ROOT / "deploy" / "wp-content" / "mu-plugins"
OUT = ROOT / "deploy" / "ybb-site-manager-product-live-patch.zip"

PATCH_FILES: list[tuple[Path, str]] = [
    (MU / "ybb-site-manager-loader.php", "ybb-site-manager-loader.php"),
    (
        MU / "ybb-site-manager" / "ybb-site-manager.php",
        "ybb-site-manager/ybb-site-manager.php",
    ),
    (
        MU / "ybb-site-manager" / "includes" / "class-settings.php",
        "ybb-site-manager/includes/class-settings.php",
    ),
    (
        MU / "ybb-site-manager" / "includes" / "class-rest.php",
        "ybb-site-manager/includes/class-rest.php",
    ),
    (
        MU / "ybb-site-manager" / "includes" / "modules" / "product-index.php",
        "ybb-site-manager/includes/modules/product-index.php",
    ),
    (
        MU / "ybb-site-manager" / "includes" / "modules" / "products.php",
        "ybb-site-manager/includes/modules/products.php",
    ),
    (
        MU / "ybb-site-manager" / "includes" / "modules" / "pdp.php",
        "ybb-site-manager/includes/modules/pdp.php",
    ),
    (
        MU / "ybb-site-manager" / "includes" / "modules" / "deploy-queue.php",
        "ybb-site-manager/includes/modules/deploy-queue.php",
    ),
    (
        MU / "ybb-site-manager" / "includes" / "modules" / "navigation.php",
        "ybb-site-manager/includes/modules/navigation.php",
    ),
    (
        MU / "ybb-site-manager" / "includes" / "modules" / "product-description-editor.php",
        "ybb-site-manager/includes/modules/product-description-editor.php",
    ),
    (
        MU / "ybb-site-manager" / "includes" / "class-sanitize.php",
        "ybb-site-manager/includes/class-sanitize.php",
    ),
    (
        MU / "ybb-site-manager" / "includes" / "modules" / "audit-log.php",
        "ybb-site-manager/includes/modules/audit-log.php",
    ),
    (
        MU / "ybb-site-manager" / "includes" / "admin" / "tab-products.php",
        "ybb-site-manager/includes/admin/tab-products.php",
    ),
]


def main() -> int:
    missing = [str(p) for p, _ in PATCH_FILES if not p.is_file()]
    if missing:
        print("Missing files:", ", ".join(missing), flush=True)
        return 1

    OUT.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(OUT, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        for local, arc in PATCH_FILES:
            zf.write(local, arc)

    print(OUT)
    print(f"files={len(PATCH_FILES)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
