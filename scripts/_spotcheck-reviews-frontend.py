#!/usr/bin/env python3
"""Spot-check REST + Store API review counts for imported products."""
from __future__ import annotations

import csv
import json
import time
import urllib.error
import urllib.request
from pathlib import Path

SKILL = Path(__file__).resolve().parents[2]
IMPORT_DIR = SKILL / "reports/product-reviews-import"
SITE = "https://carp-ybb.com"
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36"


def get_json(url: str) -> tuple[int, dict | str]:
    req = urllib.request.Request(url, headers={"Accept": "application/json", "User-Agent": UA})
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            body = resp.read().decode("utf-8", errors="replace")
            return resp.status, json.loads(body)
    except urllib.error.HTTPError as exc:
        return exc.code, exc.read().decode("utf-8", errors="replace")[:200]


def sample_products() -> list[dict]:
    seen: set[str] = set()
    out: list[dict] = []
    for path in sorted(IMPORT_DIR.glob("all-products-reviews-import*.csv")):
        with path.open(encoding="utf-8-sig", newline="") as fh:
            for row in csv.DictReader(fh):
                h = row["product_handle"]
                if h in seen:
                    continue
                seen.add(h)
                out.append(
                    {
                        "handle": h,
                        "wc_id": int(row["wc_product_id"]),
                        "csv": path.name,
                    }
                )
                if len(out) >= 10:
                    return out
    return out


def main() -> int:
    t = int(time.time() * 1000)
    rows = []
    for item in sample_products():
        wc_id = item["wc_id"]
        ybb_url = f"{SITE}/wp-json/ybb/v1/product-reviews/{wc_id}?limit=1&_={t}"
        store_url = f"{SITE}/index.php?rest_route=/wc/store/v1/products/{wc_id}"
        y_status, y_data = get_json(ybb_url)
        s_status, s_data = get_json(store_url)
        y_count = y_data.get("review_count") if isinstance(y_data, dict) else None
        s_count = s_data.get("review_count") if isinstance(s_data, dict) else None
        author = None
        if isinstance(y_data, dict) and y_data.get("reviews"):
            author = y_data["reviews"][0].get("author")
        rows.append(
            {
                **item,
                "ybb_status": y_status,
                "ybb_count": y_count,
                "store_status": s_status,
                "store_count": s_count,
                "first_author": author,
                "pdp_url": f"{SITE}/products/{item['handle']}.html",
                "reviews_url": f"{SITE}/products/reviews/{item['handle']}.html",
            }
        )
    print(json.dumps(rows, ensure_ascii=False, indent=2))
    ok = sum(1 for r in rows if (r.get("ybb_count") or 0) > 0)
    print(f"\nSummary: {ok}/{len(rows)} samples have YBB REST reviews", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
