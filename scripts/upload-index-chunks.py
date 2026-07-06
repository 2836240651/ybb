#!/usr/bin/env python3
"""Upload _next static assets referenced by out/index.html (fix 404 chunks)."""
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

# Known missing from console + homepage critical chunks
EXTRA = [
    "_next/static/chunks/b0d5f4df8ab44d3b.css",
    "_next/static/chunks/46d0514b3d5fba46.js",
    "_next/static/chunks/7fdf92de9b174696.js",
    "_next/static/chunks/ff65165468c43a65.js",
    "_next/static/chunks/33e365abee1688f8.js",
]


def collect_paths() -> list[str]:
    html = INDEX.read_text(encoding="utf-8")
    refs = set(re.findall(r"/_next/static/[^\"'\s>]+", html))
    refs.update(EXTRA)
    paths = sorted(p.lstrip("/") for p in refs)
    return paths


def main() -> int:
    if not INDEX.is_file():
        print(f"missing {INDEX}")
        return 1

    paths = collect_paths()
    ftp = load_secrets()["ftp"]
    remote = ftp["remoteRoot"].rstrip("/")

    uploads: list[tuple[Path, str]] = [(INDEX, "index.html")]
    for rel in paths:
        local = OUT / rel.replace("/", "\\") if "\\" in str(OUT) else OUT / rel
        local = OUT / Path(rel)
        if local.is_file():
            uploads.append((local, rel.replace("\\", "/")))
        else:
            print(f"[skip] missing local {rel}")

    print(f"[upload-index-chunks] {len(uploads)} files")
    client = None
    for local, rel in uploads:
        for attempt in range(1, 4):
            try:
                if client is None:
                    client = connect_ftps(ftp)
                print(f"[upload] {rel} ({local.stat().st_size} bytes)")
                _upload_file(client, remote, local, rel)
                break
            except Exception as exc:
                print(f"[retry] {rel} attempt {attempt}: {exc!r}")
                if client:
                    try:
                        client.quit()
                    except Exception:
                        pass
                client = None
                time.sleep(2)
        else:
            return 1

    if client:
        try:
            client.quit()
        except Exception:
            pass

    print("[upload-index-chunks] done")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
