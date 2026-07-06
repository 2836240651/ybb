#!/usr/bin/env python3
"""Deploy site-manager product-live patch via single zip + unzip (no serial FTPS)."""
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

ZIP_PATH = ROOT / "deploy" / "ybb-site-manager-product-live-patch.zip"
UNZIP_PHP = ROOT / "deploy" / "unzip-site-manager-patch.php"
PACK_SCRIPT = ROOT / "scripts" / "pack-site-manager-product-live-patch.py"
REMOTE_ZIP = "wp-content/mu-plugins/ybb-site-manager-product-live-patch.zip"
REMOTE_UNZIP_ROOT = "unzip-site-manager-patch.php"
REMOTE_UNZIP_BAD = "wp-content/mu-plugins/unzip-site-manager-patch.php"


def delete_remote_ftps(remote_paths: list[str]) -> None:
    import json
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


def curl_text(path: str) -> tuple[int, str]:
    import time

    url = urllib.parse.urljoin(SITE_URL, path)
    if "?" in path:
        url += f"&_={int(time.time())}"
    else:
        url += f"?_={int(time.time())}"
    req = urllib.request.Request(
        url,
        headers={
            "Accept": "application/json",
            "Cache-Control": "no-cache",
            "Pragma": "no-cache",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            return resp.status, resp.read().decode("utf-8", errors="replace")
    except urllib.error.HTTPError as exc:
        return exc.code, exc.read().decode("utf-8", errors="replace")


def curl_json(path: str) -> tuple[int, dict | None, str]:
    status, body = curl_text(path)
    if "extracted" in body and body.strip().startswith("extracted"):
        return status, None, body
    if not body.strip():
        return status, None, body
    try:
        return status, json.loads(body), body
    except json.JSONDecodeError:
        return status, None, body


def verify_rest() -> list[str]:
    failures: list[str] = []

    status, data, body = curl_json("/wp-json/ybb/v1/site-manager/product-overrides")
    print(f"[verify] product-overrides -> HTTP {status} len={len(body)}")
    if body.strip().startswith("extracted"):
        failures.append("product-overrides polluted by unzip output")
    elif status != 200 or not isinstance(data, dict):
        failures.append(f"product-overrides -> HTTP {status} body={body[:80]!r}")
    elif "overrides" not in data:
        failures.append("product-overrides missing overrides field")

    status, data, body = curl_json("/wp-json/ybb/v1/site-manager/product-live/tz-hk-001")
    print(f"[verify] product-live/tz-hk-001 -> HTTP {status} len={len(body)}")
    if body.strip().startswith("extracted"):
        failures.append("product-live polluted by unzip output")
    elif status != 200 or not isinstance(data, dict):
        failures.append(f"product-live/tz-hk-001 -> HTTP {status} body={body[:80]!r}")
    else:
        images = data.get("images") or []
        print(f"[verify] images count={len(images)}")
        if not images:
            failures.append("product-live/tz-hk-001 missing images[]")
        else:
            joined = " ".join(str(u) for u in images)
            print(f"[verify] first image: {images[0]}")
            if "三角�?" not in joined and "2026/07" not in joined:
                failures.append(f"product-live images unexpected: {joined[:120]}")

    return failures


def main() -> int:
    pack = subprocess.run([sys.executable, str(PACK_SCRIPT)], cwd=ROOT)
    if pack.returncode != 0:
        return pack.returncode
    if not ZIP_PATH.is_file() or not UNZIP_PHP.is_file():
        print("Missing zip or unzip php", file=sys.stderr)
        return 1

    print("[deploy] remove bad mu-plugins unzip if present")
    delete_remote_ftps([REMOTE_UNZIP_BAD])

    print(f"[deploy] FTPS upload zip ({ZIP_PATH.stat().st_size} bytes) + unzip helper")
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

    print("[deploy] cleanup unzip helper + zip on server")
    delete_remote_ftps([REMOTE_UNZIP_ROOT, REMOTE_UNZIP_BAD, REMOTE_ZIP])

    failures = verify_rest()
    if failures:
        for item in failures:
            print(f"  - {item}", file=sys.stderr)
        return 1

    print("[deploy-site-manager-patch-zip] OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
