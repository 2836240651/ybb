#!/usr/bin/env python3
"""Compare Store API + product-live images per variation."""

from __future__ import annotations

import json
import urllib.parse
import urllib.request

BASE = "https://carp-ybb.com"
HANDLE = "tz-eldz-013"


def fetch_json(path: str) -> dict:
    url = f"{BASE}/index.php?{urllib.parse.urlencode({'rest_route': path})}"
    req = urllib.request.Request(url, headers={"User-Agent": "ybb-variation-image-check/1.0"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read().decode("utf-8"))


def main() -> None:
    live = fetch_json(f"/ybb/v1/site-manager/product-live/{HANDLE}")
    gallery = live.get("gallery") or {}
    print(f"product-live gallery: {len(gallery.get('images') or [])} images, source={gallery.get('source')}")
    print(f"  first woo: {(gallery.get('wooImages') or [''])[0][:90]}")

    variants = live.get("variants") or []
    print(f"\nvariants ({len(variants)}):")
    for v in variants:
        wc_id = v.get("wcId")
        spec = v.get("spec")
        has_images = "images" in v
        store = fetch_json(f"/wc/store/v1/products/{wc_id}")
        imgs = store.get("images") or []
        src = imgs[0].get("src", "") if imgs else ""
        fname = src.rsplit("/", 1)[-1] if src else "NONE"
        print(f"  {spec:6} wcId={wc_id} live.images={has_images} store={fname}")


if __name__ == "__main__":
    main()
