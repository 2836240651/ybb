#!/usr/bin/env python3
"""Audit frontHidden for product handles via product-live REST."""
from __future__ import annotations

import json
import sys
import time
import urllib.request

SITE = "https://carp-ybb.com"
HANDLES = [
    "tz-eldz-001",
    "tz-eldz-002",
    "tz-qzdz-001",
    "tz-qzdz-002",
    "tz-qzdz-003",
    "tz-qz-010",
    "tz-qz-011",
]


def fetch(handle: str) -> dict | None:
    bust = int(time.time() * 1000)
    url = f"{SITE}/wp-json/ybb/v1/site-manager/product-live/{handle}?_={bust}"
    req = urllib.request.Request(url, headers={"User-Agent": "ybb-audit/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode())
    except Exception as exc:
        print(f"{handle}: ERROR {exc}", file=sys.stderr)
        return None


def main() -> int:
    hidden = []
    for handle in HANDLES:
        data = fetch(handle)
        if not data:
            continue
        fh = bool(data.get("frontHidden"))
        print(
            f"{handle}: frontHidden={fh} wooStatus={data.get('wooStatus')} wcId={data.get('wcId')}"
        )
        if fh:
            hidden.append(handle)
    print(f"\nhidden_count={len(hidden)}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
