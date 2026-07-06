#!/usr/bin/env python3
"""Upload Next.js static export to SiteGround via SFTP.

Default: incremental â€?compare remote stat vs local size/mtime, upload only changes.
"""

from __future__ import annotations

import json
import os
import sys
import time
from pathlib import Path

import paramiko

sys.path.insert(0, str(Path(__file__).resolve().parent))
from deploy_upload import (
    BACKUP_DIR,
    OUT_DIR,
    RemoteFile,
    collect_local_files,
    load_manifest,
    merge_htaccess,
    plan_manifest_uploads,
    plan_uploads,
    print_plan,
    save_manifest,
)

ROOT = Path(__file__).resolve().parents[1]
SECRETS = ROOT / "secrets.local.json"


def load_secrets() -> dict:
    return json.loads(SECRETS.read_text(encoding="utf-8"))


def ensure_remote_dir(sftp: paramiko.SFTPClient, remote_dir: str) -> None:
    remote_dir = remote_dir.rstrip("/") or "/"
    if remote_dir == "/":
        return
    parts = [p for p in remote_dir.split("/") if p]
    cur = ""
    for part in parts:
        cur += "/" + part
        try:
            sftp.stat(cur)
        except FileNotFoundError:
            sftp.mkdir(cur)
            print(f"[mkdir] {cur}")


def build_remote_index(sftp: paramiko.SFTPClient, remote_root: str, local_files: list) -> dict[str, RemoteFile]:
    index: dict[str, RemoteFile] = {}
    by_dir: dict[str, list] = {}
    for item in local_files:
        rel_dir = os.path.dirname(item.rel) or "."
        by_dir.setdefault(rel_dir, []).append(item)

    for rel_dir, items in by_dir.items():
        target = remote_root if rel_dir == "." else f"{remote_root}/{rel_dir}".replace("//", "/")
        try:
            attrs = {entry.filename: entry for entry in sftp.listdir_attr(target)}
        except FileNotFoundError:
            continue
        for item in items:
            fname = os.path.basename(item.rel)
            entry = attrs.get(fname)
            if entry is None:
                continue
            index[item.rel] = RemoteFile(size=entry.st_size or 0, mtime=float(entry.st_mtime or 0))
    print(f"[remote-index] SFTP indexed {len(index)} remote files")
    return index


def download_if_exists(sftp: paramiko.SFTPClient, remote: str, local: Path) -> bool:
    try:
        sftp.stat(remote)
        local.parent.mkdir(parents=True, exist_ok=True)
        sftp.get(remote, str(local))
        print(f"[backup] {remote}")
        return True
    except FileNotFoundError:
        print(f"[skip-backup] {remote}")
        return False


def upload_file(sftp: paramiko.SFTPClient, local: Path, remote: str) -> None:
    remote_dir = os.path.dirname(remote)
    if remote_dir:
        ensure_remote_dir(sftp, remote_dir)
    sftp.put(str(local), remote)


def main() -> int:
    dry_run = "--dry-run" in sys.argv
    full = "--full" in sys.argv
    verify_remote = "--verify-remote" in sys.argv
    if not OUT_DIR.exists():
        print("Missing out/. Run scripts/build-static.ps1", file=sys.stderr)
        return 1
    if not SECRETS.exists():
        print("Missing secrets.local.json", file=sys.stderr)
        return 1

    secrets = load_secrets()
    ftp = secrets["ftp"]
    remote_root = ftp["remoteRoot"].rstrip("/") or ""

    stamp = time.strftime("%Y%m%d-%H%M%S")
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    local_files = collect_local_files()
    manifest_files = load_manifest()

    if full or not manifest_files:
        to_upload, stats = plan_manifest_uploads(local_files, manifest_files, full=True)
        source = "full"
    elif verify_remote:
        to_upload, stats = [], {}
        source = "remote"
    else:
        to_upload, stats = plan_manifest_uploads(local_files, manifest_files, full=False)
        source = "manifest"

    if dry_run and not verify_remote:
        print_plan(len(local_files), to_upload, stats, dry_run=True, source=source)
        return 0

    transport = paramiko.Transport((ftp["host"], int(ftp["port"])))
    transport.connect(username=ftp["username"], password=ftp["password"])
    sftp = paramiko.SFTPClient.from_transport(transport)

    try:
        for name in [".htaccess", "index.php", "index.html"]:
            remote = f"{remote_root}/{name}".replace("//", "/")
            download_if_exists(sftp, remote, BACKUP_DIR / f"{stamp}-{name}")

        merged = merge_htaccess(stamp)
        remote_index: dict[str, RemoteFile] | None = None

        if verify_remote:
            remote_index = build_remote_index(sftp, remote_root, local_files)
            to_upload, stats = plan_uploads(local_files, remote_index, full=full)
            source = "remote"

        print_plan(len(local_files), to_upload, stats, dry_run=dry_run, source=source)

        upload_htaccess = full or not manifest_files.get(".htaccess") or manifest_files[".htaccess"].get("size") != merged.stat().st_size
        if remote_index is not None:
            upload_htaccess = full or remote_index.get(".htaccess") is None or merged.stat().st_size != remote_index[".htaccess"].size

        if dry_run:
            if upload_htaccess:
                print("[dry-run] would upload .htaccess (merged)")
            return 0

        if upload_htaccess:
            upload_file(sftp, merged, f"{remote_root}/.htaccess".replace("//", "/"))
            print("[upload] .htaccess (merged)")
        else:
            print("[skip] .htaccess unchanged")

        for i, item in enumerate(to_upload, 1):
            remote = f"{remote_root}/{item.rel}".replace("//", "/")
            upload_file(sftp, item.path, remote)
            if i % 25 == 0 or i == len(to_upload):
                print(f"[progress] {i}/{len(to_upload)}")

        save_manifest(local_files)
        print(f"[deploy-sftp] uploaded {len(to_upload)} files")
        return 0
    finally:
        sftp.close()
        transport.close()


if __name__ == "__main__":
    raise SystemExit(main())
