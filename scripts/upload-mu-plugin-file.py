#!/usr/bin/env python3
"""Upload a single mu-plugin file via FTPS (emergency backup path)."""
from __future__ import annotations

import json
import os
import sys
import time
from ftplib import FTP_TLS, error_perm
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SECRETS = ROOT / "secrets.local.json"


def load_secrets() -> dict:
    return json.loads(SECRETS.read_text(encoding="utf-8"))


def connect_ftps(ftp_cfg: dict) -> FTP_TLS:
    client = FTP_TLS()
    client.connect(ftp_cfg["host"], int(ftp_cfg.get("port", 21)), timeout=180)
    client.login(ftp_cfg["username"], ftp_cfg["password"])
    client.prot_p()
    client.set_pasv(True)
    return client


def ensure_remote_dir(client: FTP_TLS, base: str, rel_dir: str) -> None:
    client.cwd(base)
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


def upload_file(ftp_cfg: dict, local: Path, rel_path: str) -> None:
    rel_path = rel_path.replace("\\", "/").lstrip("/")
    rel_dir = os.path.dirname(rel_path)
    fname = os.path.basename(rel_path)
    remote_root = ftp_cfg["remoteRoot"].rstrip("/")

    for attempt in range(1, 4):
        client = None
        try:
            client = connect_ftps(ftp_cfg)
            ensure_remote_dir(client, remote_root, rel_dir)
            with local.open("rb") as fh:
                client.storbinary(f"STOR {fname}", fh, blocksize=8192)
            print(f"[upload] {rel_path} ({local.stat().st_size} bytes)")
            return
        except Exception as exc:
            print(f"[retry] attempt {attempt}: {exc!r}")
            if attempt >= 3:
                raise
            time.sleep(2 * attempt)
        finally:
            if client is not None:
                try:
                    client.quit()
                except Exception:
                    pass


def main() -> int:
    if len(sys.argv) < 2:
        print("Usage: py upload-mu-plugin-file.py <relative-path-under-mu-plugins>")
        return 1

    rel = sys.argv[1].replace("\\", "/").lstrip("/")
    if rel.startswith("wp-content/mu-plugins/"):
        rel = rel[len("wp-content/mu-plugins/") :]
    local = ROOT / "deploy" / "wp-content" / "mu-plugins" / rel
    if not local.is_file():
        print(f"missing: {local}")
        return 1

    upload_file(load_secrets()["ftp"], local, f"wp-content/mu-plugins/{rel}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
