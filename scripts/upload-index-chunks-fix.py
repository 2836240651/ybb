#!/usr/bin/env python3
"""Upload index.html + all /_next/static assets referenced in it."""
from __future__ import annotations

import re
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from deploy_ftps import _upload_file, connect_ftps, load_secrets

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "out"
INDEX = OUT / "index.html"


def collect_paths() -> list[str]:
    html = INDEX.read_text(encoding="utf-8")
    refs = set(re.findall(r'["\'](/_next/static/[^"\']+)["\']', html))
    return sorted(p.lstrip("/") for p in refs if p.endswith((".js", ".css", ".woff2")))


def main() -> int:
    paths = collect_paths()
    ftp = load_secrets()["ftp"]
    remote = ftp["remoteRoot"].rstrip("/")
    uploads: list[tuple[Path, str]] = [(INDEX, "index.html")]
    for rel in paths:
        local = OUT / rel
        if local.is_file():
            uploads.append((local, rel))
        else:
            print(f"[skip] missing {rel}")

    print(f"[upload] {len(uploads)} files")
    client = connect_ftps(ftp)
    for i, (local, rel) in enumerate(uploads, 1):
        for attempt in range(1, 4):
            try:
                print(f"[{i}/{len(uploads)}] {rel} ({local.stat().st_size})")
                _upload_file(client, remote, local, rel)
                break
            except Exception as exc:
                print(f"[retry] {rel} {attempt}: {exc!r}")
                try:
                    client.quit()
                except Exception:
                    pass
                client = connect_ftps(ftp)
                time.sleep(1)
        else:
            return 1
    client.quit()
    print("[upload-index-chunks-fix] done")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
