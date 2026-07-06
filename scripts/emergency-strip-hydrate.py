#!/usr/bin/env python3
"""EMERGENCY: strip hydrate scripts from index.html and upload to restore site."""
from __future__ import annotations

import re
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from deploy_ftps import _upload_file, connect_ftps, load_secrets

ROOT = Path(__file__).resolve().parents[1]
INDEX = ROOT / "out" / "index.html"


def strip_hydrate(html: str) -> str:
    html = re.sub(
        r'<script[^>]*id="ybb-latest-stories-hydrate"[^>]*>\s*</script>',
        "",
        html,
    )
    html = re.sub(
        r'<script[^>]*id="ybb-hot-products-hydrate"[^>]*>\s*</script>',
        "",
        html,
    )
    html = re.sub(
        r'<script[^>]*rest_route=/ybb/v1/latest-stories-hydrate\.js[^>]*>\s*</script>',
        "",
        html,
    )
    html = re.sub(
        r'<script[^>]*rest_route=/ybb/v1/hot-products-hydrate\.js[^>]*>\s*</script>',
        "",
        html,
    )
    return html


def main() -> int:
    if not INDEX.is_file():
        print(f"missing {INDEX}")
        return 1

    html = INDEX.read_text(encoding="utf-8")
    cleaned = strip_hydrate(html)
    if cleaned == html:
        print("[strip] no hydrate tags found (already clean)")
    else:
        backup = INDEX.with_suffix(".html.bak-emergency")
        backup.write_text(html, encoding="utf-8")
        INDEX.write_text(cleaned, encoding="utf-8")
        print(f"[strip] removed hydrate scripts, backup: {backup.name}")

    ftp = load_secrets()["ftp"]
    remote = ftp["remoteRoot"].rstrip("/")
    client = None
    for attempt in range(1, 4):
        try:
            if client is None:
                client = connect_ftps(ftp)
            print(f"[upload] index.html ({INDEX.stat().st_size} bytes)")
            _upload_file(client, remote, INDEX, "index.html")
            break
        except Exception as exc:
            print(f"[retry] {attempt}: {exc!r}")
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

    print("[emergency-strip-hydrate] done �?site should load without hydrate loops")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
