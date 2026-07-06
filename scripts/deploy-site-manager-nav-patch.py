#!/usr/bin/env python3
"""Deploy site-manager v1.8.3 nav empty-collection warnings patch."""
from __future__ import annotations

import json
import subprocess
import sys
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

from siteground_deploy import SITE_URL, trigger_php_url, upload_files_ftps  # noqa: E402

ZIP_PATH = ROOT / "deploy" / "ybb-site-manager-nav-patch.zip"
UNZIP_PHP = ROOT / "deploy" / "unzip-site-manager-patch.php"
PACK_SCRIPT = ROOT / "scripts" / "pack-site-manager-nav-patch.py"
REMOTE_ZIP = "wp-content/mu-plugins/ybb-site-manager-nav-patch.zip"
REMOTE_UNZIP_ROOT = "unzip-site-manager-patch.php"
REMOTE_UNZIP_BAD = "wp-content/mu-plugins/unzip-site-manager-patch.php"


def delete_remote_ftps(remote_paths: list[str]) -> None:
    import time
    from ftplib import FTP_TLS, error_perm

    secrets = json.loads((ROOT / "secrets.local.json").read_text(encoding="utf-8"))
    ftp = secrets["ftp"]
    remote_root = ftp.get("remoteRoot", "").rstrip("/") or "/carp-ybb.com/public_html"
    for rel in remote_paths:
        rel_path = rel.replace("\\", "/").lstrip("/")
        fname = rel_path.split("/")[-1]
        rel_dir = "/".join(rel_path.split("/")[:-1])
        for attempt in range(1, 4):
            client = FTP_TLS()
            try:
                client.connect(ftp["host"], int(ftp.get("port", 21)), timeout=120)
                client.login(ftp["username"], ftp["password"])
                client.prot_p()
                client.set_pasv(True)
                client.cwd(remote_root)
                if rel_dir:
                    for part in rel_dir.split("/"):
                        if part:
                            client.cwd(part)
                try:
                    client.delete(fname)
                    print(f"[cleanup] deleted {rel_path}")
                except error_perm as exc:
                    print(f"[cleanup] skip {rel_path}: {exc}")
                client.quit()
                break
            except Exception as exc:
                print(f"[cleanup] retry {rel_path} attempt {attempt}/3: {exc}")
                try:
                    client.quit()
                except Exception:
                    pass
                time.sleep(3 * attempt)


def curl_json(path: str) -> tuple[int, dict | None, str]:
    import time

    url = urllib.parse.urljoin(SITE_URL, path)
    url += ("&" if "?" in path else "?") + f"_={int(time.time())}"
    req = urllib.request.Request(
        url,
        headers={"Accept": "application/json", "Cache-Control": "no-cache"},
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            body = resp.read().decode("utf-8", errors="replace")
            try:
                return resp.status, json.loads(body), body
            except json.JSONDecodeError:
                return resp.status, None, body
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        try:
            return exc.code, json.loads(body), body
        except json.JSONDecodeError:
            return exc.code, None, body


def main() -> int:
    pack = subprocess.run([sys.executable, str(PACK_SCRIPT)], cwd=ROOT)
    if pack.returncode != 0:
        return pack.returncode
    if not ZIP_PATH.is_file() or not UNZIP_PHP.is_file():
        print("Missing zip or unzip php", file=sys.stderr)
        return 1

    delete_remote_ftps([REMOTE_UNZIP_BAD])
    print(f"[deploy] FTPS upload nav patch zip ({ZIP_PATH.stat().st_size} bytes)")
    upload_files_ftps(
        [
            (ZIP_PATH, REMOTE_ZIP),
            (UNZIP_PHP, REMOTE_UNZIP_ROOT),
        ]
    )

    trigger_php_url(
        f"/{REMOTE_UNZIP_ROOT}",
        "extracted",
        label="unzip-site-manager-patch.php",
    )
    delete_remote_ftps([REMOTE_UNZIP_ROOT, REMOTE_UNZIP_BAD, REMOTE_ZIP])

    status, data, body = curl_json("/wp-json/ybb/v1/site-manager/navigation")
    print(f"[verify] navigation -> HTTP {status} len={len(body)}")
    if status != 200 or not isinstance(data, dict) or not data.get("primaryNav"):
        print(f"[verify] FAIL navigation body={body[:120]!r}", file=sys.stderr)
        return 1

    print("[deploy-site-manager-nav-patch] OK v1.8.3")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
