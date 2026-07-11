#!/usr/bin/env python3
"""Upload single mu-plugin file via FTPS and verify remote size."""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from deploy_ftps import connect_ftps, download_if_exists, load_secrets, upload_file_with_retry

REL = "wp-content/mu-plugins/ybb-site-manager/includes/admin/page.php"
LOCAL = Path(__file__).resolve().parents[1] / "deploy" / REL.replace("/", "\\").replace("deploy\\", "deploy\\")


def main() -> int:
    local = Path(__file__).resolve().parents[1] / "deploy/wp-content/mu-plugins/ybb-site-manager/includes/admin/page.php"
    secrets = load_secrets()
    ftp = secrets["ftp"]
    root = ftp.get("remoteRoot", "").rstrip("/")
    client = connect_ftps(ftp)
    tmp = Path(__file__).resolve().parents[1] / "reports/remote-page-verify.php"
    tmp.parent.mkdir(exist_ok=True)
    try:
        client = upload_file_with_retry(client, ftp, root, local, REL)
        ok = download_if_exists(client, root, REL, tmp)
        print("download_ok", ok)
        if ok:
            print("remote_dl_size", tmp.stat().st_size, "local", local.stat().st_size)
            if tmp.stat().st_size != local.stat().st_size:
                print("SIZE MISMATCH")
                return 1
        # list remote dir
        rel_dir = "wp-content/mu-plugins/ybb-site-manager/includes/admin"
        parts = [p for p in rel_dir.split("/") if p]
        client.cwd(root)
        for part in parts:
            client.cwd(part)
        names = client.nlst()
        print("remote_dir_entries", [n for n in names if "page" in n.lower()][:5])
        print("cwd_ok")
    finally:
        client.quit()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
