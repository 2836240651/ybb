#!/usr/bin/env python3
"""
PDP gallery acceptance checks.

Usage:
  py scripts/product-gallery-acceptance.py --base https://carp-ybb.com --handles tz-hk-001 tz-zj-002
"""

from __future__ import annotations

import argparse
import json
import sys
import urllib.error
import urllib.parse
import urllib.request


def fetch_json(url: str) -> dict:
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": "ybb-product-gallery-acceptance/1.0",
            "Cache-Control": "no-cache",
        },
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read().decode("utf-8"))


def check_handle(base: str, handle: str) -> tuple[bool, str]:
    route = f"/ybb/v1/site-manager/product-live/{handle}"
    url = f"{base.rstrip('/')}/index.php?{urllib.parse.urlencode({'rest_route': route})}"
    try:
        payload = fetch_json(url)
    except urllib.error.HTTPError as e:
        return False, f"{handle}: HTTP {e.code}"
    except Exception as e:  # noqa: BLE001
        return False, f"{handle}: request failed ({e})"

    gallery = payload.get("gallery")
    if not isinstance(gallery, dict):
        return False, f"{handle}: missing gallery payload"

    required = ["enabled", "layout", "defaultIndex", "images", "hideIndexes"]
    missing = [k for k in required if k not in gallery]
    if missing:
        return False, f"{handle}: gallery missing fields {missing}"

    if gallery.get("layout") != "bottom-strip":
        return False, f"{handle}: unexpected layout={gallery.get('layout')}"

    source = gallery.get("source")
    if source not in (None, "woo", "override"):
        return False, f"{handle}: unexpected source={source}"

    images = gallery.get("images")
    if not isinstance(images, list):
        return False, f"{handle}: gallery.images must be array"

    hide_indexes = gallery.get("hideIndexes")
    if not isinstance(hide_indexes, list):
        return False, f"{handle}: gallery.hideIndexes must be array"

    default_index = gallery.get("defaultIndex")
    if not isinstance(default_index, int) or default_index < 0:
        return False, f"{handle}: invalid defaultIndex={default_index}"

    return True, (
        f"{handle}: OK images={len(images)} wooImages={len(gallery.get('wooImages') or [])} "
        f"source={gallery.get('source')} defaultIndex={default_index} enabled={gallery.get('enabled')}"
    )


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base", default="https://carp-ybb.com")
    parser.add_argument("--handles", nargs="+", required=True)
    args = parser.parse_args()

    ok = True
    for handle in args.handles:
        passed, msg = check_handle(args.base, handle)
        print(msg)
        ok = ok and passed

    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())

