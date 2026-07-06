#!/usr/bin/env python3
"""Upload Next.js static export to SiteGround �?**备用** FTPS 增量路径�?
默认生产部署请用�?  scripts/deploy-siteground-browser.ps1
  scripts/restore-htaccess-siteground.ps1

See: docs/siteground-browser-deploy.md
"""

from __future__ import annotations

import json
import os
import sys
import time
from ftplib import FTP_TLS, error_perm
from io import BytesIO
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from deploy_upload import (
    BACKUP_DIR,
    OUT_DIR,
    LocalFile,
    RemoteFile,
    collect_local_files,
    extract_build_id,
    load_manifest,
    merge_htaccess,
    parse_mdtm_response,
    parse_mlsd_mtime,
    plan_manifest_uploads,
    plan_uploads,
    print_plan,
    save_manifest,
)

ROOT = Path(__file__).resolve().parents[1]
SECRETS = ROOT / "secrets.local.json"


def load_secrets() -> dict:
    return json.loads(SECRETS.read_text(encoding="utf-8"))


def connect_ftps(ftp_cfg: dict) -> FTP_TLS:
    host = ftp_cfg["host"]
    port = int(ftp_cfg.get("port", 21))
    client = FTP_TLS()
    client.connect(host, port, timeout=180)
    client.login(ftp_cfg["username"], ftp_cfg["password"])
    client.prot_p()
    client.set_pasv(True)
    return client


def cwd_to(client: FTP_TLS, remote_dir: str) -> None:
    remote_dir = remote_dir.replace("\\", "/").rstrip("/") or "/"
    client.cwd(remote_dir)


def ensure_remote_dir(client: FTP_TLS, base: str, rel_dir: str) -> None:
    cwd_to(client, base)
    if not rel_dir or rel_dir == ".":
        return
    for part in rel_dir.replace("\\", "/").split("/"):
        if not part:
            continue
        try:
            client.cwd(part)
        except error_perm:
            client.mkd(part)
            client.cwd(part)


def build_remote_index(client: FTP_TLS, remote_root: str, local_files: list[LocalFile]) -> dict[str, RemoteFile]:
    """Per-directory MLSD: one listing per folder instead of SIZE per file."""
    index: dict[str, RemoteFile] = {}
    by_dir: dict[str, list[LocalFile]] = {}
    for item in local_files:
        rel_dir = os.path.dirname(item.rel) or "."
        by_dir.setdefault(rel_dir, []).append(item)

    dirs = sorted(by_dir.keys(), key=lambda d: d.count("/"))
    for i, rel_dir in enumerate(dirs, 1):
        target = remote_root if rel_dir == "." else f"{remote_root}/{rel_dir}".replace("//", "/")
        try:
            cwd_to(client, target)
            entries = {name: facts for name, facts in client.mlsd() if name not in (".", "..")}
        except error_perm:
            continue
        except EOFError:
            print(f"[remote-index] connection dropped at {rel_dir}")
            break

        for item in by_dir[rel_dir]:
            fname = os.path.basename(item.rel)
            facts = entries.get(fname)
            if facts and facts.get("type") in ("file", ""):
                size = int(facts.get("size", "0") or 0)
                mtime = parse_mlsd_mtime(facts.get("modify"))
                index[item.rel] = RemoteFile(size=size, mtime=mtime)
                continue
            try:
                size = client.size(fname)
                if size is not None:
                    mtime = None
                    try:
                        mtime = parse_mdtm_response(client.sendcmd(f"MDTM {fname}"))
                    except error_perm:
                        pass
                    index[item.rel] = RemoteFile(size=size, mtime=mtime)
            except error_perm:
                pass

        if i % 25 == 0 or i == len(dirs):
            print(f"[remote-index] scanned {i}/{len(dirs)} dirs, {len(index)} files")

    print(f"[remote-index] indexed {len(index)}/{len(local_files)} remote files")
    return index


def download_if_exists(client: FTP_TLS, remote_root: str, name: str, local: Path) -> bool:
    cwd_to(client, remote_root)
    try:
        names = client.nlst()
    except error_perm:
        print(f"[skip-backup] {name}")
        return False
    if name not in names:
        print(f"[skip-backup] {name}")
        return False
    buf = BytesIO()
    client.retrbinary(f"RETR {name}", buf.write, blocksize=8192)
    local.parent.mkdir(parents=True, exist_ok=True)
    local.write_bytes(buf.getvalue())
    print(f"[backup] {remote_root}/{name} ({len(buf.getvalue())} bytes)")
    return True


def upload_file(ftp_cfg: dict, remote_root: str, local: Path, rel_path: str) -> None:
    """Upload one file (opens a short-lived FTPS connection). Used by WC sync one-liners."""
    client = connect_ftps(ftp_cfg)
    try:
        _upload_file(client, remote_root, local, rel_path)
    finally:
        try:
            client.quit()
        except Exception:
            pass


def _upload_file(client: FTP_TLS, remote_root: str, local: Path, rel_path: str) -> None:
    rel_path = rel_path.replace("\\", "/").lstrip("/")
    rel_dir = os.path.dirname(rel_path)
    fname = os.path.basename(rel_path)
    ensure_remote_dir(client, remote_root, rel_dir)
    with local.open("rb") as fh:
        client.storbinary(f"STOR {fname}", fh, blocksize=8192)


def reconnect(client: FTP_TLS | None, ftp_cfg: dict) -> FTP_TLS:
    if client is not None:
        try:
            client.close()
        except Exception:
            pass
    return connect_ftps(ftp_cfg)


def upload_file_with_retry(
    client: FTP_TLS,
    ftp_cfg: dict,
    remote_root: str,
    local: Path,
    rel_path: str,
    *,
    attempts: int = 3,
) -> FTP_TLS:
    for attempt in range(1, attempts + 1):
        try:
            _upload_file(client, remote_root, local, rel_path)
            return client
        except (EOFError, OSError) as exc:
            if attempt >= attempts:
                raise
            print(f"[retry] {rel_path} attempt {attempt}/{attempts}: {exc}")
            client = reconnect(client, ftp_cfg)
            time.sleep(min(2 * attempt, 5))
    return client


def htaccess_needs_upload(
    merged: Path,
    *,
    full: bool,
    manifest_files: dict[str, dict],
    remote_index: dict[str, RemoteFile] | None,
) -> bool:
    if full:
        return True
    prev = manifest_files.get(".htaccess")
    if prev is None or prev.get("size") != merged.stat().st_size:
        return True
    if remote_index is not None:
        remote = remote_index.get(".htaccess")
        return remote is None or remote.size != merged.stat().st_size
    return False


def main() -> int:
    dry_run = "--dry-run" in sys.argv
    full = "--full" in sys.argv
    verify_remote = "--verify-remote" in sys.argv
    skip_htaccess = "--skip-htaccess" in sys.argv
    skip_backup = "--skip-backup" in sys.argv or dry_run

    if not OUT_DIR.exists():
        print("Missing out/. Run scripts/build-static.ps1", file=sys.stderr)
        return 1
    if not SECRETS.exists():
        print("Missing secrets.local.json", file=sys.stderr)
        return 1

    secrets = load_secrets()
    ftp_cfg = secrets["ftp"]
    remote_root = ftp_cfg.get("remoteRoot", "").rstrip("/") or "/carp-ybb.com/public_html"

    stamp = time.strftime("%Y%m%d-%H%M%S")
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)

    local_files = collect_local_files()
    manifest_files = load_manifest()
    source = "manifest"
    if full:
        to_upload, stats = plan_manifest_uploads(local_files, manifest_files, full=True)
    elif verify_remote:
        source = "remote"
        to_upload, stats = [], {"unchanged": 0, "missing-remote": 0, "size-changed": 0, "local-newer": 0, "forced": 0}
    elif manifest_files:
        to_upload, stats = plan_manifest_uploads(local_files, manifest_files, full=False)
    else:
        local_build = extract_build_id()
        print(
            "[deploy] no upload-manifest.json �?use scripts/deploy-zip.ps1 for full sync "
            f"(local buildId={local_build}). FTPS --full uploads every out/ file."
        )
        to_upload, stats = plan_manifest_uploads(local_files, manifest_files, full=True)

    print(
        f"[deploy-ftps] host={ftp_cfg['host']} remote={remote_root} "
        f"local={len(local_files)} dry_run={dry_run} full={full} verify_remote={verify_remote}"
    )

    if dry_run and not verify_remote:
        print_plan(len(local_files), to_upload, stats, dry_run=True, source=source)
        merged = merge_htaccess(stamp)
        if skip_htaccess:
            print("[dry-run] would skip .htaccess (--skip-htaccess)")
        elif full or not manifest_files or manifest_files.get(".htaccess", {}).get("size") != merged.stat().st_size:
            print("[dry-run] would upload .htaccess (merged)")
        else:
            print("[dry-run] would skip .htaccess")
        return 0

    client = connect_ftps(ftp_cfg)
    try:
        if not skip_backup:
            backup_failed = False
            for name in [".htaccess", "index.php", "index.html"]:
                try:
                    download_if_exists(client, remote_root, name, BACKUP_DIR / f"{stamp}-{name}")
                except Exception as exc:
                    print(f"[backup-fail] {name}: {exc}")
                    backup_failed = True
            if backup_failed:
                print("[reconnect] backup failure detected; opening a fresh FTPS session")
                client = reconnect(client, ftp_cfg)
        else:
            print("[skip-backup] using existing backups or defaults")

        merged = merge_htaccess(stamp)
        remote_index: dict[str, RemoteFile] | None = None

        if verify_remote:
            remote_index = build_remote_index(client, remote_root, local_files)
            to_upload, stats = plan_uploads(local_files, remote_index, full=full)
            print_plan(len(local_files), to_upload, stats, dry_run=dry_run, source=source)
        elif not dry_run:
            print_plan(len(local_files), to_upload, stats, dry_run=False, source=source)

        upload_htaccess = False if skip_htaccess else htaccess_needs_upload(
            merged, full=full, manifest_files=manifest_files, remote_index=remote_index
        )

        if dry_run:
            if upload_htaccess:
                print("[dry-run] would upload .htaccess (merged)")
            return 0

        if upload_htaccess:
            client = upload_file_with_retry(client, ftp_cfg, remote_root, merged, ".htaccess")
            print("[upload] .htaccess (merged)")
        elif skip_htaccess:
            print("[skip] .htaccess (--skip-htaccess)")
        else:
            print("[skip] .htaccess unchanged")

        for i, item in enumerate(to_upload, 1):
            client = upload_file_with_retry(client, ftp_cfg, remote_root, item.path, item.rel)
            if i % 25 == 0 or i == len(to_upload):
                print(f"[progress] {i}/{len(to_upload)}")

        save_manifest(local_files)
        print(f"[deploy-ftps] uploaded {len(to_upload)} files (+ .htaccess={'yes' if upload_htaccess else 'no'})")
        return 0
    finally:
        try:
            client.quit()
        except Exception:
            pass


if __name__ == "__main__":
    raise SystemExit(main())
