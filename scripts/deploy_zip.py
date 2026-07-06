#!/usr/bin/env python3
"""Deprecated FTPS deploy entry �?use SiteGround browser deploy instead."""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def main() -> int:
    print(
        "[deploy_zip.py] deprecated: use scripts/deploy-siteground-browser.ps1 "
        "(SiteGround File Manager + restore-htaccess.php).",
        file=sys.stderr,
    )
    if "--legacy-ftp" in sys.argv:
        print("[deploy_zip.py] --legacy-ftp is disabled by policy. Use browser deploy.", file=sys.stderr)
        return 1

    args = [sys.executable, str(ROOT / "scripts" / "siteground_deploy_cli.py"), "deploy-static"]
    if "--dry-run" in sys.argv:
        args.append("--dry-run")
    if "--auto-upload" in sys.argv:
        args.append("--auto-upload")
    return subprocess.call(args)


if __name__ == "__main__":
    raise SystemExit(main())
