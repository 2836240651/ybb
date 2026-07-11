#!/usr/bin/env python3
"""BAX mu-plugin regression — production REST + static assets (no admin login)."""
from __future__ import annotations

import json
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REPORT = ROOT / "reports" / "blog-bax-regression.json"
SITE = "https://carp-ybb.com"


def fetch(path: str) -> tuple[int, str]:
    url = urllib.parse.urljoin(SITE, path)
    sep = "&" if "?" in url else "?"
    url = f"{url}{sep}_={int(time.time() * 1000)}"
    req = urllib.request.Request(
        url,
        headers={"Accept": "application/json", "Cache-Control": "no-cache"},
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            return resp.status, resp.read().decode("utf-8", errors="replace")
    except urllib.error.HTTPError as exc:
        return exc.code, exc.read().decode("utf-8", errors="replace")


def fetch_asset(path: str) -> tuple[int, int, str]:
    url = urllib.parse.urljoin(SITE, path)
    req = urllib.request.Request(url, headers={"Cache-Control": "no-cache"})
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            body = resp.read().decode("utf-8", errors="replace")
            return resp.status, len(body), body
    except urllib.error.HTTPError as exc:
        return exc.code, 0, exc.read().decode("utf-8", errors="replace")


def main() -> int:
    report: dict = {
        "at": datetime.now(timezone.utc).isoformat(),
        "suite": "blog-bax-regression",
        "pass": [],
        "fail": [],
        "warn": [],
    }

    def ok(msg: str) -> None:
        report["pass"].append(msg)

    def bad(msg: str) -> None:
        report["fail"].append(msg)

    def warn(msg: str) -> None:
        report["warn"].append(msg)

    # TC-REST-01 blog full shape
    st, body = fetch("/wp-json/ybb/v1/site-manager/blog")
    if st != 200:
        bad(f"TC-REST-01 blog HTTP {st}")
    else:
        try:
            data = json.loads(body)
        except json.JSONDecodeError:
            bad("TC-REST-01 blog JSON parse failed")
            data = {}
        articles = data.get("articles") or []
        if not isinstance(articles, list) or len(articles) < 10:
            bad(f"TC-REST-01 articles count {len(articles)} < 10")
        else:
            ok(f"TC-REST-01 blog REST 200, {len(articles)} articles")
        sample = articles[0] if articles else {}
        for key in ("handle", "title", "content", "href"):
            if key not in sample:
                bad(f"TC-REST-01 missing article.{key}")
        if "contentBlocks" in sample:
            ok("TC-REST-01 contentBlocks field present on articles")

    # TC-REST-02 latest-stories lightweight
    st2, body2 = fetch("/wp-json/ybb/v1/latest-stories")
    if st2 != 200:
        bad(f"TC-REST-02 latest-stories HTTP {st2}")
    else:
        ls = json.loads(body2)
        cards = ls.get("articles") or []
        polluted = any("contentBlocks" in (c or {}) for c in cards)
        if polluted:
            bad("TC-REST-02 latest-stories cards contain contentBlocks")
        elif cards:
            ok(f"TC-REST-02 latest-stories 200, {len(cards)} cards, body-free")
        elif ls.get("enabled") is False:
            warn("TC-REST-02 latest-stories disabled (首页模块总开关)")
        else:
            warn("TC-REST-02 latest-stories enabled but 0 cards")

    # TC-FE assets — BAX admin static files on SiteGround (public assets only)
    for asset, needle in [
        ("/wp-content/mu-plugins/ybb-site-manager/assets/admin-blog.js", "syncBlockFields"),
        ("/wp-content/mu-plugins/ybb-site-manager/assets/admin-blog.css", "ybb-blog-field"),
    ]:
        st_a, size_a, text_a = fetch_asset(asset)
        if st_a != 200:
            bad(f"TC-ASSET {asset} HTTP {st_a}")
        elif needle and needle not in text_a:
            bad(f"TC-ASSET {asset} missing {needle!r}")
        else:
            ok(f"TC-ASSET {asset} HTTP 200 ({size_a}b)")

    # Article / index pages (follow redirects; 403 from some IPs is captcha — warn only)
    for label, path in [
        ("TC-FE article", "/blogs/news/2026-catalog-launch"),
        ("TC-FE blog index", "/blogs/news"),
    ]:
        url = urllib.parse.urljoin(SITE, path)
        req = urllib.request.Request(
            url,
            headers={"Cache-Control": "no-cache", "User-Agent": "YBB-BAX-Regression/1.0"},
        )
        try:
            with urllib.request.urlopen(req, timeout=60) as resp:
                st_p = resp.status
        except urllib.error.HTTPError as exc:
            st_p = exc.code
        if st_p in (200, 301, 302):
            ok(f"{label} HTTP {st_p}")
        elif st_p == 403:
            warn(f"{label} HTTP 403 (likely SiteGround captcha from this IP)")
        else:
            bad(f"{label} HTTP {st_p}")

    report["verdict"] = "PASS" if not report["fail"] else "FAIL"
    REPORT.parent.mkdir(parents=True, exist_ok=True)
    REPORT.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")

    print("=== BLOG BAX REGRESSION (production REST/assets) ===")
    print(f"verdict: {report['verdict']}")
    for line in report["pass"]:
        print(f"  PASS  {line}")
    for line in report["warn"]:
        print(f"  WARN  {line}")
    for line in report["fail"]:
        print(f"  FAIL  {line}")
    print(f"report: {REPORT}")
    return 0 if report["verdict"] == "PASS" else 1


if __name__ == "__main__":
    raise SystemExit(main())
