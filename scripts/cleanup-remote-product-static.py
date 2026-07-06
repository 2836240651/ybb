#!/usr/bin/env python3
"""Remove deployed static product pages and /products/* image trees from public_html."""

from __future__ import annotations

import json
import sys
import time
from ftplib import FTP_TLS, error_perm
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SECRETS = ROOT / "secrets.local.json"
MANIFEST = ROOT / "deploy" / "upload-manifest.json"
BATCH_SIZE = 80


def load_secrets() -> dict:
    return json.loads(SECRETS.read_text(encoding="utf-8"))


def connect_ftps(ftp_cfg: dict) -> FTP_TLS:
    client = FTP_TLS()
    client.connect(ftp_cfg["host"], int(ftp_cfg.get("port", 21)), timeout=180)
    client.login(ftp_cfg["username"], ftp_cfg["password"])
    client.prot_p()
    client.set_pasv(True)
    return client


def cwd_to(client: FTP_TLS, remote_dir: str) -> None:
    remote_dir = remote_dir.replace("\\", "/").rstrip("/") or "/"
    client.cwd(remote_dir)


def manifest_product_keys() -> list[str]:
    if not MANIFEST.exists():
        return []
    raw = json.loads(MANIFEST.read_text(encoding="utf-8"))
    files = raw.get("files", raw)
    return sorted(k for k in files if k.startswith("products/"))


def delete_one(ftp_cfg: dict, remote_root: str, rel: str) -> bool:
    parts = rel.split("/")
    fname = parts[-1]
    parent = "/".join(parts[:-1])
    client = connect_ftps(ftp_cfg)
    try:
        cwd_to(client, remote_root)
        if parent:
            cwd_to(client, f"{remote_root}/{parent}")
        client.delete(fname)
        return True
    except error_perm:
        return False
    finally:
        try:
            client.quit()
        except Exception:
            pass


def delete_manifest_products(ftp_cfg: dict, remote_root: str, *, dry_run: bool) -> int:
    keys = manifest_product_keys()
    print(f"[cleanup-remote] manifest targets: {len(keys)}")
    if dry_run:
        for rel in keys[:20]:
            print(f"[dry-run] delete {rel}")
        if len(keys) > 20:
            print(f"[dry-run] ... and {len(keys) - 20} more")
        return len(keys)

    deleted = 0
    for i, rel in enumerate(keys, 1):
        for attempt in range(1, 4):
            try:
                if delete_one(ftp_cfg, remote_root, rel):
                    deleted += 1
                break
            except EOFError:
                time.sleep(2 * attempt)
        if i % BATCH_SIZE == 0:
            print(f"[cleanup-remote] progress {i}/{len(keys)} deleted={deleted}")
    return deleted


def prune_manifest() -> int:
    if not MANIFEST.exists():
        return 0
    raw = json.loads(MANIFEST.read_text(encoding="utf-8"))
    if "files" in raw:
        kept = {k: v for k, v in raw["files"].items() if not k.startswith("products/")}
        removed = len(raw["files"]) - len(kept)
        raw["files"] = kept
        raw["fileCount"] = len(kept)
    else:
        kept = {k: v for k, v in raw.items() if not k.startswith("products/")}
        removed = len(raw) - len(kept)
        raw = kept
    MANIFEST.write_text(json.dumps(raw, indent=2) + "\n", encoding="utf-8")
    return removed


def main() -> int:
    dry_run = "--dry-run" in sys.argv
    ftp_cfg = load_secrets()["ftp"]
    remote_root = ftp_cfg.get("remoteRoot", "").rstrip("/") or "/carp-ybb.com/public_html"
    print(f"[cleanup-remote] remote={remote_root} dry_run={dry_run}")

    deleted = delete_manifest_products(ftp_cfg, remote_root, dry_run=dry_run)
    print(f"[cleanup-remote] deleted files: {deleted}")

    if not dry_run:
        removed = prune_manifest()
        print(f"[cleanup-remote] manifest pruned {removed} products/* entries")

    print("[cleanup-remote] done")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
