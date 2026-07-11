"""Regression checks for blog layout + deploy (production)."""
from __future__ import annotations

import json
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LOCAL_BUILD_ID = None
INDEX_HTML = ROOT / "out" / "index.html"
if INDEX_HTML.exists():
    m = re.search(r"<!--([^>]+)-->", INDEX_HTML.read_text(encoding="utf-8", errors="replace")[:120])
    LOCAL_BUILD_ID = m.group(1) if m else None

BASE = "https://carp-ybb.com"
ARTICLES = [
    "workshop-to-tackle-shop-wholesale-supply-line",
    "2026-catalog-launch",
    "oem-packaging-guide",
    "method-feeder-trends",
    "quality-audit-checklist",
    "mixed-carton-efficiency",
    "hook-coating-standards",
    "feeder-rig-bundles",
    "lead-times-explained",
    "sustainable-packaging",
    "rig-assembly-tips",
]
BLOG_CHUNK = "a8c6440408fa3033.js"


def fetch(url: str) -> tuple[int, str]:
    req = urllib.request.Request(url, headers={"User-Agent": "ybb-blog-regression/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=45) as resp:
            return resp.status, resp.read().decode("utf-8", errors="replace")
    except urllib.error.HTTPError as exc:
        return exc.code, exc.read().decode("utf-8", errors="replace")


def build_id(html: str) -> str | None:
    m = re.search(r"<!--([^>]+)-->", html[:160])
    return m.group(1) if m else None


def main() -> int:
    failures: list[str] = []

    status, home = fetch(f"{BASE}/")
    if status != 200:
        failures.append(f"homepage HTTP {status}")
    remote_build = build_id(home)
    print(f"[home] HTTP {status} buildId={remote_build}")
    if LOCAL_BUILD_ID and remote_build != LOCAL_BUILD_ID:
        failures.append(
            f"buildId mismatch local={LOCAL_BUILD_ID} remote={remote_build}"
        )

    chunk_status, _ = fetch(f"{BASE}/_next/static/chunks/{BLOG_CHUNK}")
    print(f"[chunk] {BLOG_CHUNK} HTTP {chunk_status}")
    if chunk_status != 200:
        failures.append(f"blog chunk missing HTTP {chunk_status}")

    status, index_html = fetch(f"{BASE}/blogs/news.html")
    print(f"[blog-index] HTTP {status} buildId={build_id(index_html)}")
    if status != 200:
        failures.append("blog index HTTP != 200")
    if "Fetching the latest stories" in index_html and "blog-grid" not in index_html:
        failures.append("blog index shows empty fetching state only")

    workshop_status, workshop = fetch(
        f"{BASE}/blogs/news/workshop-to-tackle-shop-wholesale-supply-line.html"
    )
    print(f"[workshop] HTTP {workshop_status} buildId={build_id(workshop)}")
    if workshop_status != 200:
        failures.append("workshop article HTTP != 200")
    if "Loading article" in workshop and "text-title-md" not in workshop:
        failures.append("workshop shell missing title fallback")

    rest_status, rest_raw = fetch(
        f"{BASE}/wp-json/ybb/v1/site-manager/blog?_={int(__import__('time').time())}"
    )
    print(f"[rest] HTTP {rest_status}")
    if rest_status != 200:
        failures.append("blog REST HTTP != 200")
    else:
        rest = json.loads(rest_raw)
        if not rest.get("enabled") or not rest.get("articles"):
            failures.append("blog REST empty/disabled")
        workshop_live = next(
            (
                a
                for a in rest["articles"]
                if a.get("handle") == "workshop-to-tackle-shop-wholesale-supply-line"
            ),
            None,
        )
        if not workshop_live:
            failures.append("workshop missing from REST")
        elif len(workshop_live.get("contentBlocks") or []) < 5:
            failures.append("workshop contentBlocks too few")

    article_failures = 0
    for handle in ARTICLES:
        for suffix in (".html", ""):
            url = f"{BASE}/blogs/news/{handle}{suffix}"
            status, html = fetch(url)
            bid = build_id(html)
            ok = status == 200 and bid == remote_build
            flag = "OK" if ok else "WARN" if status == 200 else "FAIL"
            print(f"[article:{handle}{suffix or '(clean)'}] HTTP {status} buildId={bid} {flag}")
            if status != 200:
                failures.append(f"{handle}{suffix} HTTP {status}")
                article_failures += 1
            elif suffix == ".html" and bid != remote_build:
                failures.append(f"{handle}.html buildId stale ({bid})")
                article_failures += 1
            elif suffix == "" and bid and remote_build and bid != remote_build:
                print(f"  note: clean URL cached old buildId ({bid}) — purge SiteGround cache")

    print(f"\nSummary: {len(ARTICLES)} articles checked, article_failures={article_failures}")
    if failures:
        print("FAILURES:")
        for item in failures:
            print(f"  - {item}")
        return 1

    print("PASS blog regression")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
