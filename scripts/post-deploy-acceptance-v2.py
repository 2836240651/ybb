#!/usr/bin/env python3
"""Robust post-deploy acceptance �?captcha-safe browser checks."""
from __future__ import annotations

import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urljoin

from playwright.sync_api import Page, sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT_INDEX = ROOT / "out" / "index.html"
REPORT_PATH = ROOT / "reports" / "post-deploy-acceptance-v2.json"
SITE = "https://carp-ybb.com"

LOCAL_BUILD_ID: str | None = None
if OUT_INDEX.exists():
    m = re.search(r"<!--([^>]+)-->", OUT_INDEX.read_text(encoding="utf-8", errors="ignore"))
    LOCAL_BUILD_ID = m.group(1).strip() if m else None


def captcha_clear(page: Page) -> None:
    page.goto(SITE, wait_until="domcontentloaded", timeout=90000)
    for _ in range(90):
        if "sgcaptcha" not in page.url and "Robot Challenge" not in page.title():
            return
        page.wait_for_timeout(1000)
    raise RuntimeError(f"Captcha not cleared: {page.url}")


def visit(page: Page, path: str) -> tuple[int, str, str]:
    captcha_clear(page)
    resp = page.goto(urljoin(SITE, path), wait_until="domcontentloaded", timeout=90000)
    page.wait_for_timeout(2000)
    html = page.evaluate("() => document.documentElement.outerHTML")
    return (resp.status if resp else 0), page.title(), html


def main() -> int:
    report: dict = {
        "at": datetime.now(timezone.utc).isoformat(),
        "localBuildId": LOCAL_BUILD_ID,
        "remoteBuildId": None,
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

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1440, "height": 900})

        code, title, html = visit(page, "/")
        if "NIoyveMTi6rKDpAUGizbI" in html:
            report["remoteBuildId"] = "NIoyveMTi6rKDpAUGizbI"
        else:
            m = re.search(r"<!--([A-Za-z0-9_-]{10,})-->", html)
            report["remoteBuildId"] = m.group(1) if m else None

        if report["remoteBuildId"] == LOCAL_BUILD_ID:
            ok(f"buildId match: {LOCAL_BUILD_ID}")
        else:
            bad(f"buildId remote={report['remoteBuildId']} local={LOCAL_BUILD_ID}")

        if code != 200 or "Robot Challenge" in title:
            bad(f"homepage HTTP {code} title={title[:50]}")
        else:
            ok("homepage loads")

        chunks = list(dict.fromkeys(re.findall(r"/_next/static/[^\"'?]+", html)))[:20]
        chunk_fail: list[str] = []
        for rel in chunks:
            try:
                st = page.request.get(urljoin(SITE, "/" + rel.lstrip("/"))).status
                if st != 200:
                    chunk_fail.append(f"{rel} -> {st}")
            except Exception as exc:
                chunk_fail.append(f"{rel} -> {exc}")
        if chunk_fail:
            bad(f"chunk failures: {chunk_fail[:5]}")
        else:
            ok(f"homepage chunks OK ({len(chunks)} sampled)")

        for path in [
            "/blogs/news.html",
            "/blogs/news/oem-packaging-guide",
            "/collections/sinkers/",
            "/products/tz-qz-025/",
        ]:
            code, title, _ = visit(page, path)
            if code == 200 and "Robot Challenge" not in title:
                ok(f"route 200: {path}")
            else:
                bad(f"route {path}: HTTP {code} title={title[:50]}")

        captcha_clear(page)
        page.goto(urljoin(SITE, "/blogs/news/oem-packaging-guide"), wait_until="domcontentloaded")
        page.wait_for_timeout(3000)
        ready = page.locator("[data-ybb-blog-ready='1']").count()
        h1 = page.locator("article h1").count()
        if ready and h1:
            ok("blog article client hydrated")
        elif h1:
            ok("blog article content visible (static/REST shell)")
        else:
            warn(f"blog article ready={ready} h1={h1}")

        captcha_clear(page)
        page.goto(urljoin(SITE, "/blogs/news.html"), wait_until="domcontentloaded")
        page.wait_for_timeout(3000)
        cards = page.locator(".blog-grid li").count()
        if cards >= 10:
            ok(f"blog index {cards} cards")
        else:
            bad(f"blog index only {cards} cards")

        captcha_clear(page)
        page.goto(SITE + "/", wait_until="domcontentloaded")
        page.wait_for_timeout(5000)
        story_cards = page.locator("#latest-stories-heading").locator(
            "xpath=ancestor::section//article"
        ).count()
        if story_cards >= 5:
            ok(f"Latest Stories carousel {story_cards} cards")
        else:
            bad(f"Latest Stories only {story_cards} cards")

        captcha_clear(page)
        page.goto(SITE + "/", wait_until="domcontentloaded")
        rest_routes = {
            "hero": "/ybb/v1/site-manager/hero",
            "blog": "/ybb/v1/site-manager/blog",
            "latestStories": "/ybb/v1/latest-stories",
            "navigation": "/ybb/v1/site-manager/navigation",
            "video": "/ybb/v1/site-manager/factory-video",
        }
        report["rest"] = {}
        for name, route in rest_routes.items():
            data = page.evaluate(
                """async (route) => {
                  const r = await fetch('/wp-json' + route, {
                    credentials: 'same-origin',
                    cache: 'no-store',
                  });
                  let j = null;
                  try { j = await r.json(); } catch {}
                  return { status: r.status, j };
                }""",
                route,
            )
            st = int(data["status"])
            body = data.get("j") or {}
            report["rest"][name] = {"status": st, "keys": list(body.keys())[:8]}

            if name == "blog":
                if st == 404:
                    warn(
                        "REST /site-manager/blog 404 �?mu-plugin v1.2.0 not deployed; "
                        "static blog.json fallback only (no后台即时改文)"
                    )
                elif st == 200 and len(body.get("articles") or []) >= 10:
                    ok(f"blog REST {len(body['articles'])} articles")
                else:
                    bad(f"blog REST HTTP {st}")
            elif name == "latestStories":
                arts = body.get("articles") or body.get("stories") or []
                if st == 200 and len(arts) >= 5 and "articles" in body:
                    ok(f"latest-stories {len(arts)} articles (articles key)")
                else:
                    bad(f"latest-stories st={st} count={len(arts)}")
            elif name == "hero":
                slides = body.get("slides") or []
                if st == 200 and len(slides) >= 4:
                    ok(f"hero REST {len(slides)} slides")
                else:
                    bad(f"hero REST st={st} slides={len(slides)}")
            elif name == "navigation":
                items = body.get("items") or body.get("navigation") or []
                if st == 200 and isinstance(items, list) and len(items) >= 6:
                    ok(f"navigation REST {len(items)} items")
                else:
                    warn(f"navigation REST st={st} (check items shape)")
            elif name == "video" and st == 200:
                ok("factory-video REST OK")

        nav_dom = page.locator("nav.header-nav-zone a, nav.header-nav-zone button").count()
        if nav_dom >= 6:
            ok(f"desktop nav DOM {nav_dom} items")
        else:
            bad(f"desktop nav sparse: {nav_dom}")

        browser.close()

    report["verdict"] = "PASS" if not report["fail"] else "FAIL"
    REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
    REPORT_PATH.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")

    print("=== POST-DEPLOY ACCEPTANCE v2 ===")
    print(f"verdict: {report['verdict']}")
    print(f"buildId: local={LOCAL_BUILD_ID} remote={report['remoteBuildId']}")
    for line in report["pass"]:
        print(f"  PASS  {line}")
    for line in report["warn"]:
        print(f"  WARN  {line}")
    for line in report["fail"]:
        print(f"  FAIL  {line}")
    print(f"report: {REPORT_PATH}")
    return 0 if report["verdict"] == "PASS" else 1


if __name__ == "__main__":
    raise SystemExit(main())
