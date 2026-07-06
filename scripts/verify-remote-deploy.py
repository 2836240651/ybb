#!/usr/bin/env python3
"""Verify carp-ybb.com deployment: buildId + all referenced assets return 200."""

from __future__ import annotations

import re
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT_INDEX = ROOT / "out" / "index.html"
SITE = "https://carp-ybb.com"


def fetch(url: str) -> tuple[int, bytes]:
    req = urllib.request.Request(
        url,
        headers={"User-Agent": "ybb-verify/1.0", "Cache-Control": "no-cache"},
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        return resp.status, resp.read()


def extract_build_id(html: str) -> str | None:
    m = re.search(r"<!--([^>]+)-->", html)
    return m.group(1).strip() if m else None


def extract_assets(html: str) -> list[str]:
    patterns = [
        r'(?:src|href)="(/_next/static/[^"]+)"',
        r'(?:src|href)="(/images/[^"]+)"',
    ]
    seen: set[str] = set()
    out: list[str] = []
    for pat in patterns:
        for rel in re.findall(pat, html):
            rel = rel.split("?", 1)[0]
            if rel not in seen:
                seen.add(rel)
                out.append(rel)
    return out


def main() -> int:
    bust = int(time.time() * 1000)
    status, body = fetch(f"{SITE}/?v={bust}")
    html = body.decode("utf-8", errors="ignore")
    remote_bid = extract_build_id(html)
    local_bid = None
    if OUT_INDEX.exists():
        local_bid = extract_build_id(OUT_INDEX.read_text(encoding="utf-8", errors="ignore"))

    print(f"[verify] homepage HTTP {status}")
    print(f"[verify] remote buildId={remote_bid}")
    print(f"[verify] local  buildId={local_bid}")

    if status != 200:
        print("[verify] FAIL homepage not 200", file=sys.stderr)
        return 1
    if not remote_bid:
        print("[verify] FAIL missing buildId", file=sys.stderr)
        return 1
    if local_bid and remote_bid != local_bid:
        print("[verify] FAIL buildId mismatch", file=sys.stderr)
        return 1

    assets = extract_assets(html)
    print(f"[verify] checking {len(assets)} assets from remote HTML...")
    failures: list[str] = []
    for rel in assets:
        url = urllib.parse.urljoin(SITE, rel)
        try:
            code, _ = fetch(f"{url}?v={remote_bid}")
            if code != 200:
                failures.append(f"{rel} -> HTTP {code}")
        except Exception as exc:
            failures.append(f"{rel} -> {exc}")

    if failures:
        print(f"[verify] FAIL {len(failures)} assets missing:", file=sys.stderr)
        for item in failures[:30]:
            print(f"  - {item}", file=sys.stderr)
        if len(failures) > 30:
            print(f"  ... and {len(failures) - 30} more", file=sys.stderr)
        return 1

    print("[verify] PASS all referenced assets OK")

    empty_url = f"{SITE}/collections/2026-new-products?v={bust}"
    empty_status, empty_body = fetch(empty_url)
    empty_html = empty_body.decode("utf-8", errors="ignore")
    empty_bid = extract_build_id(empty_html)
    print(f"[verify] empty collection HTTP {empty_status} buildId={empty_bid}")
    if empty_status != 200:
        print("[verify] FAIL empty collection not 200", file=sys.stderr)
        return 1
    if local_bid and empty_bid != local_bid:
        print("[verify] FAIL empty collection buildId mismatch", file=sys.stderr)
        return 1
    if "hard-nav-capture.js" not in empty_html:
        print("[verify] FAIL empty collection missing hard-nav-capture.js", file=sys.stderr)
        return 1

    print("[verify] PASS empty collection HTML aligned")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
