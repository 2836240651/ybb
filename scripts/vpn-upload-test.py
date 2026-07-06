#!/usr/bin/env python3
"""One-off SiteGround FTPS upload speed test."""
from __future__ import annotations

import sys
import time
import urllib.request
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(Path(__file__).resolve().parent))
from deploy_ftps import load_secrets, upload_file

ZIP_PATH = ROOT / "deploy" / "vpn-upload-test.zip"
REMOTE_REL = "_vpn-upload-test/vpn-upload-test.zip"
PUBLIC_URL = "https://carp-ybb.com/_vpn-upload-test/vpn-upload-test.zip"
TARGET_BYTES = 5 * 1024 * 1024


def ensure_zip() -> int:
    ZIP_PATH.parent.mkdir(parents=True, exist_ok=True)
    if ZIP_PATH.is_file() and ZIP_PATH.stat().st_size >= TARGET_BYTES - 65536:
        return ZIP_PATH.stat().st_size

    payload = b"YBB-VPN-UPLOAD-TEST-" * 65536
    with zipfile.ZipFile(ZIP_PATH, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        written = 0
        idx = 0
        while written < TARGET_BYTES:
            chunk = payload[: min(len(payload), TARGET_BYTES - written)]
            zf.writestr(f"chunk-{idx:03d}.bin", chunk)
            written += len(chunk)
            idx += 1
    return ZIP_PATH.stat().st_size


def verify_remote(expected_size: int) -> tuple[int, int]:
    req = urllib.request.Request(PUBLIC_URL, method="HEAD")
    with urllib.request.urlopen(req, timeout=60) as resp:
        length = int(resp.headers.get("Content-Length", "0") or 0)
        return resp.status, length


def main() -> int:
    size = ensure_zip()
    print(f"[local] {ZIP_PATH} ({size:,} bytes)")

    secrets = load_secrets()
    ftp = secrets["ftp"]
    remote_root = ftp["remoteRoot"].rstrip("/")

    t0 = time.perf_counter()
    try:
        upload_file(ftp, remote_root, ZIP_PATH, REMOTE_REL)
    except Exception as exc:
        elapsed = time.perf_counter() - t0
        print(f"[ftps] FAILED after {elapsed:.1f}s: {type(exc).__name__}: {exc}")
        return 1

    elapsed = time.perf_counter() - t0
    mbps = (size / (1024 * 1024)) / elapsed if elapsed > 0 else 0
    print(f"[ftps] OK in {elapsed:.1f}s (~{mbps:.2f} MB/s) -> {REMOTE_REL}")

    time.sleep(2)
    try:
        status, remote_len = verify_remote(size)
        print(f"[verify] HTTP {status} Content-Length={remote_len:,}")
        if remote_len == 0:
            print("[verify] WARN remote file is 0 bytes")
            return 2
        if abs(remote_len - size) > 1024:
            print(f"[verify] WARN size mismatch local={size:,} remote={remote_len:,}")
        else:
            print("[verify] size OK")
    except Exception as exc:
        print(f"[verify] FAILED: {exc}")
        return 3

    print(f"[done] public URL: {PUBLIC_URL}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
