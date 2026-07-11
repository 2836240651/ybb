"""Verify clean static URLs 301 → .html (no self-redirect loops)."""
from __future__ import annotations

import json
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "out"
BASE = "https://carp-ybb.com"

SAMPLES = [
    "/",
    "/blogs/news",
    "/blogs/news/workshop-to-tackle-shop-wholesale-supply-line",
    "/blogs/news/2026-catalog-launch",
    "/collections/all",
    "/collections/bait-cages",
    "/pages/oem-odm",
    "/products/tz-zj-002",
    "/products/reviews/tz-zj-002",
]


def fetch_headers(url: str) -> tuple[int, dict[str, str]]:
    req = urllib.request.Request(url, method="HEAD", headers={"User-Agent": "ybb-clean-url-audit/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=45) as resp:
            return resp.status, {k.lower(): v for k, v in resp.headers.items()}
    except urllib.error.HTTPError as exc:
        return exc.code, {k.lower(): v for k, v in exc.headers.items()}


def main() -> int:
    failures: list[str] = []
    print(f"[audit] checking {len(SAMPLES)} sample clean URLs on {BASE}")

    for path in SAMPLES:
        url = BASE + path
        status, headers = fetch_headers(url)
        location = headers.get("location", "")
        if path == "/":
            ok = status == 200
            detail = "homepage 200"
        elif status == 301 and location.endswith(path.split("/")[-1] + ".html"):
            ok = True
            detail = f"301 → {location}"
        elif status == 301 and location.rstrip("/") == url.rstrip("/"):
            ok = False
            detail = f"LOOP 301 → {location}"
            failures.append(f"{path}: redirect loop")
        elif status == 200:
            ok = True
            detail = "200 direct"
        else:
            ok = False
            detail = f"HTTP {status} location={location or '-'}"
            failures.append(f"{path}: {detail}")
        flag = "OK" if ok else "FAIL"
        print(f"  [{flag}] {path} — {detail}")

    blog_paths = sorted(
        "/" + p.relative_to(OUT).as_posix().removesuffix(".html")
        for p in OUT.glob("blogs/**/*.html")
        if p.name != "news.html" or p.parent.name != "news"
    )
    blog_index = "/blogs/news"
    article_paths = [p for p in blog_paths if p.count("/") >= 3]

    print(f"\n[audit] blog articles from out/: {len(article_paths)}")
    loop_count = 0
    for path in article_paths[:15]:
        status, headers = fetch_headers(BASE + path)
        location = headers.get("location", "")
        if status == 301 and location.rstrip("/") == (BASE + path).rstrip("/"):
            loop_count += 1
            failures.append(f"{path}: loop")
            print(f"  [FAIL] {path} loop")
        elif status == 301 and location.endswith(".html"):
            print(f"  [OK] {path} → .html")
        elif status == 200:
            print(f"  [OK] {path} 200")
        else:
            failures.append(f"{path}: HTTP {status}")
            print(f"  [FAIL] {path} HTTP {status} loc={location}")

    if loop_count:
        print(f"\nFAIL {loop_count} blog loops detected")
        return 1
    if failures:
        print("\nFAILURES:")
        for item in failures:
            print(f"  - {item}")
        return 1

    print("\nPASS clean URL redirect audit")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
