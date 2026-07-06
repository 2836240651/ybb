#!/usr/bin/env python3
"""Upload critical missing assets after partial deploy (chunks + images)."""

from __future__ import annotations

import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from deploy_ftps import load_secrets, upload_file

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "out"

# From verify-remote-deploy.py failures + all index.html chunk refs
CRITICAL = [
    "_next/static/chunks/4f2961811601c852.js",
    "_next/static/chunks/65282a3170d17d1c.js",
    "index.html",
]


def all_chunks_from_index() -> list[str]:
    import re

    html = (OUT / "index.html").read_text(encoding="utf-8", errors="ignore")
    return sorted(
        {
            rel.lstrip("/")
            for rel in re.findall(r"/(_next/static/chunks/[^\"']+)", html)
        }
    )


def main() -> int:
    secrets = load_secrets()
    ftp = secrets["ftp"]
    remote_root = ftp.get("remoteRoot", "").rstrip("/") or "/carp-ybb.com/public_html"

    paths = list(dict.fromkeys(CRITICAL + all_chunks_from_index()))
  # collection images referenced on homepage
    import re

    html = (OUT / "index.html").read_text(encoding="utf-8", errors="ignore")
    for rel in re.findall(r'"(/images/[^"]+)"', html):
        paths.append(rel.lstrip("/"))

    paths = list(dict.fromkeys(paths))
    print(f"[upload-critical] {len(paths)} files")

    failed: list[str] = []
    for i, rel in enumerate(paths, 1):
        local = OUT / rel.replace("/", "\\")
        if not local.exists():
            print(f"[skip] missing local {rel}")
            continue
        for attempt in range(1, 4):
            try:
                upload_file(ftp, remote_root, local, rel)
                print(f"[{i}/{len(paths)}] OK {rel}")
                break
            except Exception as exc:
                print(f"[retry {attempt}/3] {rel}: {exc}")
                time.sleep(3 * attempt)
        else:
            failed.append(rel)

    if failed:
        print(f"[upload-critical] FAILED {len(failed)}:", file=sys.stderr)
        for f in failed:
            print(f"  - {f}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
