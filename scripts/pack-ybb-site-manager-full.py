#!/usr/bin/env python3
"""Pack full ybb-site-manager mu-plugin for zip extract on server."""
from __future__ import annotations

import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MU = ROOT / "deploy/wp-content/mu-plugins"
SM = MU / "ybb-site-manager"
OUT = MU / "ybb-site-manager-product-live-patch.zip"


def main() -> int:
    files: list[tuple[Path, str]] = [
        (MU / "ybb-site-manager-loader.php", "ybb-site-manager-loader.php"),
    ]
    for path in sorted(SM.rglob("*")):
        if not path.is_file():
            continue
        arc = "ybb-site-manager/" + path.relative_to(SM).as_posix()
        files.append((path, arc))

    OUT.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(OUT, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        for local, arc in files:
            zf.write(local, arc)

    print(OUT)
    print(f"files={len(files)} size={OUT.stat().st_size}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
