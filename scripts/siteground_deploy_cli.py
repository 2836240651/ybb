#!/usr/bin/env python3
"""CLI for SiteGround zip deploy: FTPS upload + server unzip (fully automated by default)."""

from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

from deploy_upload import OUT_DIR, collect_local_files, extract_build_id, save_manifest
from siteground_deploy import (
    RESTORE_DATA,
    RESTORE_PHP,
    ZIP_PATH,
    UNZIP_PHP,
    cleanup_restore_artifacts_via_browser_note,
    fetch_remote_build_id,
    load_secrets,
    prepare_htaccess_bundle,
    trigger_htaccess_restore,
    trigger_unzip,
    upload_deploy_artifacts,
    verify_routes,
)


def upload_kwargs(args: argparse.Namespace) -> dict:
    return {
        "manual_upload": args.manual_upload,
        "auto_upload": args.auto_upload,
    }


def cmd_restore_htaccess(args: argparse.Namespace) -> int:
    stamp = time.strftime("%Y%m%d-%H%M%S")
    prepare_htaccess_bundle(stamp)
    files = [RESTORE_PHP, RESTORE_DATA]

    if args.dry_run:
        print("[dry-run] would upload:", ", ".join(p.name for p in files))
        print("[dry-run] would trigger restore-htaccess.php")
        return 0

    upload_deploy_artifacts(files, **upload_kwargs(args))
    trigger_htaccess_restore()

    if not args.skip_verify:
        failures = verify_routes()
        if failures:
            for item in failures:
                print(f"  - {item}", file=sys.stderr)
            return 1
    cleanup_restore_artifacts_via_browser_note()
    return 0


def cmd_deploy_static(args: argparse.Namespace) -> int:
    if not OUT_DIR.exists() or not ZIP_PATH.exists() or not UNZIP_PHP.exists():
        print("Missing out/ or deploy zip. Run scripts/build-static.ps1 -SkipDeploy", file=sys.stderr)
        return 1

    local_build = extract_build_id()
    remote_build = fetch_remote_build_id()
    print(f"[deploy-siteground] local buildId={local_build} remote buildId={remote_build}")

    stamp = time.strftime("%Y%m%d-%H%M%S")
    prepare_htaccess_bundle(stamp)
    files = [ZIP_PATH, UNZIP_PHP, RESTORE_PHP, RESTORE_DATA]

    if args.dry_run:
        print("[dry-run] FTPS upload:", ", ".join(p.name for p in files))
        print("[dry-run] trigger unzip-export.php + restore-htaccess.php (browser fallback if captcha)")
        return 0

    if local_build and remote_build == local_build:
        print("[deploy-siteground] remote already matches local buildId �?htaccess-only refresh")
        upload_deploy_artifacts([RESTORE_PHP, RESTORE_DATA], **upload_kwargs(args))
        trigger_htaccess_restore()
    else:
        upload_deploy_artifacts(files, **upload_kwargs(args))
        trigger_unzip()
        trigger_htaccess_restore()
        save_manifest(collect_local_files())

    new_remote = fetch_remote_build_id()
    print(f"[deploy-siteground] remote buildId={new_remote}")
    if local_build and new_remote != local_build:
        if args.skip_verify:
            print(
                "[deploy-siteground] warning: buildId mismatch (purge cache if frontend looks stale)",
                file=sys.stderr,
            )
        else:
            print(
                "[deploy-siteground] buildId still differs �?purge SiteGround cache and retry",
                file=sys.stderr,
            )
            return 1

    if not args.skip_verify:
        failures = verify_routes()
        if failures:
            for item in failures:
                print(f"  - {item}", file=sys.stderr)
            return 1

    cleanup_restore_artifacts_via_browser_note()
    print("[deploy-siteground] route verification passed")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(
        description="SiteGround zip deploy (default: FTPS 4 files + server unzip)"
    )
    parser.add_argument("command", choices=["restore-htaccess", "deploy-static"])
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument(
        "--manual-upload",
        action="store_true",
        help="Open SiteGround File Manager and wait for manual upload (legacy)",
    )
    parser.add_argument(
        "--auto-upload",
        action="store_true",
        help="Upload via SiteGround File Manager Playwright (instead of FTPS)",
    )
    parser.add_argument("--skip-verify", action="store_true")
    args = parser.parse_args()

    try:
        load_secrets()
    except Exception as exc:
        print(exc, file=sys.stderr)
        return 1

    if args.command == "restore-htaccess":
        return cmd_restore_htaccess(args)
    return cmd_deploy_static(args)


if __name__ == "__main__":
    raise SystemExit(main())
