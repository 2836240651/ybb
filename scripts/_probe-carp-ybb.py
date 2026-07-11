#!/usr/bin/env python3
"""Quick HTTP probe for carp-ybb.com production health."""
from __future__ import annotations

import json
import re
import time
import urllib.error
import urllib.request

BASE = "https://carp-ybb.com"
TS = int(time.time())
BAD = [
    "product.tabDescription",
    "product.tabAdditionalInfo",
    "product.tabReviews",
    "product.reviewsBadgeCount",
]


def fetch(path: str, accept: str = "application/json") -> tuple[int, str, dict]:
    sep = "&" if "?" in path else "?"
    url = f"{BASE}{path}{sep}_={TS}"
    req = urllib.request.Request(
        url,
        headers={"Accept": accept, "Cache-Control": "no-cache"},
    )
    try:
        with urllib.request.urlopen(req, timeout=45) as resp:
            body = resp.read().decode("utf-8", "replace")
            return resp.status, body, dict(resp.headers)
    except urllib.error.HTTPError as exc:
        return exc.code, exc.read().decode("utf-8", "replace"), dict(exc.headers)


def main() -> int:
    rows: list[tuple[str, str, int, bool, str]] = []

    rest_paths = [
        "/wp-json/ybb/v1/site-manager/product-overrides",
        "/wp-json/ybb/v1/site-manager/product-live/tz-qz-002",
        "/wp-json/ybb/v1/site-manager/product-live/tz-hk-001",
        "/wp-json/ybb/v1/site-manager/navigation",
    ]
    for path in rest_paths:
        status, body, _ = fetch(path)
        data = None
        try:
            data = json.loads(body)
        except json.JSONDecodeError:
            pass
        ok = status == 200 and isinstance(data, dict)
        extra = ""
        if ok and "product-live" in path:
            labels = data.get("pdpTabLabels") or {}
            zh = (labels.get("description") or {}).get("zh", "")
            extra = f" pdpTabLabels.description.zh={zh!r}"
        elif ok and path.endswith("navigation"):
            extra = f" navItems={len(data.get('primaryNav') or [])}"
        elif ok and path.endswith("product-overrides"):
            extra = f" overrides={len(data.get('overrides') or {})}"
        rows.append(("REST", path, status, ok, extra))

    for path in [
        "/",
        "/products/tz-qz-002.html",
        "/products/tz-qz-002",
        "/collections/sinkers.html",
        "/collections/sinkers",
    ]:
        status, body, _ = fetch(path, accept="text/html")
        issues = [k for k in BAD if k in body]
        ok = status == 200 and not issues
        extra = f" raw_keys={issues}" if issues else ""
        rows.append(("PAGE", path, status, ok, extra))

    for path in ["/collections/sinkers.txt", "/products/tz-qz-002.txt"]:
        status, _, headers = fetch(path, accept="text/html")
        loc = headers.get("Location") or headers.get("location") or ""
        ok = status in (200, 301, 302) or (status == 302 and ".html" in loc)
        extra = f" location={loc}" if loc else ""
        rows.append(("TXT", path, status, ok, extra))

    print("=== carp-ybb.com HTTP probe ===")
    fails = 0
    for kind, path, status, ok, extra in rows:
        mark = "OK" if ok else "FAIL"
        if not ok:
            fails += 1
        print(f"[{mark}] {kind} {status} {path}{extra}")

    print(f"\n{len(rows) - fails}/{len(rows)} passed")
    return 1 if fails else 0


if __name__ == "__main__":
    raise SystemExit(main())
