#!/usr/bin/env python3
"""Round-2 acceptance: blog REST mu-plugin + frontend hydration."""
from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urljoin

from playwright.sync_api import Page, sync_playwright

ROOT = Path(__file__).resolve().parents[1]
REPORT = ROOT / "reports" / "blog-rest-acceptance-round2.json"
SITE = "https://carp-ybb.com"
EXPECTED_ARTICLES = 10
EXPECTED_HOME_FEATURED = 5


def captcha_clear(page: Page) -> None:
    page.goto(SITE, wait_until="domcontentloaded", timeout=90000)
    for _ in range(90):
        if "sgcaptcha" not in page.url and "Robot Challenge" not in page.title():
            return
        page.wait_for_timeout(1000)
    raise RuntimeError(f"Captcha not cleared: {page.url}")


def fetch_rest_batch(page: Page, routes: list[str]) -> dict[str, dict]:
    captcha_clear(page)
    out: dict[str, dict] = {}
    for route in routes:
        path = route if route.startswith("/wp-json") else f"/wp-json{route}"
        page.goto(urljoin(SITE, path), wait_until="domcontentloaded", timeout=90000)
        page.wait_for_timeout(1200)
        text = page.locator("body").inner_text()
        try:
            body = json.loads(text)
            out[route] = {"status": 200, "body": body}
        except json.JSONDecodeError:
            out[route] = {"status": 202 if "Robot" in page.title() else 0, "body": None, "preview": text[:120]}
    return out


def main() -> int:
    report: dict = {
        "at": datetime.now(timezone.utc).isoformat(),
        "round": 2,
        "focus": "blog REST mu-plugin v1.2.0",
        "pass": [],
        "fail": [],
        "warn": [],
        "rest": {},
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
        captcha_clear(page)

        rest_batch = fetch_rest_batch(
            page,
            ["/ybb/v1/site-manager/blog", "/ybb/v1/latest-stories"],
        )
        raw = rest_batch.get("/ybb/v1/site-manager/blog") or {}
        st = int(raw.get("status") or 0)
        body = raw.get("body") or {}
        report["rest"]["blog"] = {
            "status": st,
            "enabled": body.get("enabled") if isinstance(body, dict) else None,
            "handle": body.get("handle") if isinstance(body, dict) else None,
            "articleCount": len(body.get("articles") or []) if isinstance(body, dict) else 0,
            "syncedAt": body.get("syncedAt") if isinstance(body, dict) else None,
        }

        if st != 200:
            bad(f"blog REST HTTP {st}")
        elif not isinstance(body, dict):
            bad("blog REST body not object")
        else:
            articles = body.get("articles") or []
            if len(articles) >= EXPECTED_ARTICLES:
                ok(f"blog REST {len(articles)} articles")
            else:
                bad(f"blog REST only {len(articles)} articles (expected>={EXPECTED_ARTICLES})")

            if body.get("enabled"):
                ok("blog module enabled")
            else:
                bad("blog module disabled")

            if body.get("handle") == "news":
                ok("blog handle=news")
            else:
                warn(f"blog handle={body.get('handle')}")

            sample = articles[0] if articles else {}
            required = ["handle", "title", "excerpt", "publishedAt", "imageUrl", "content", "href"]
            missing = [k for k in required if not sample.get(k)]
            if not missing and isinstance(sample.get("content"), list) and sample["content"]:
                ok("blog article schema complete (sample)")
            else:
                bad(f"blog article schema missing: {missing}")

            featured = [a for a in articles if a.get("featuredOnHome")]
            if len(featured) >= EXPECTED_HOME_FEATURED:
                ok(f"blog featuredOnHome {len(featured)} articles")
            else:
                warn(f"blog featuredOnHome only {len(featured)}")

        # --- Latest Stories should align with blog featured ---
        raw_ls = rest_batch.get("/ybb/v1/latest-stories") or {}
        ls_st = int(raw_ls.get("status") or 0)
        ls = raw_ls.get("body") or {}
        report["rest"]["latestStories"] = {
            "status": ls_st,
            "articleCount": len(ls.get("articles") or []) if isinstance(ls, dict) else 0,
            "hasArticlesKey": isinstance(ls, dict) and "articles" in ls,
        }

        if ls_st == 200 and isinstance(ls, dict) and "articles" in ls:
            ls_arts = ls.get("articles") or []
            if len(ls_arts) >= EXPECTED_HOME_FEATURED:
                ok(f"latest-stories {len(ls_arts)} cards via articles key")
            else:
                bad(f"latest-stories only {len(ls_arts)} cards")
            if isinstance(body, dict):
                blog_featured = [a["handle"] for a in (body.get("articles") or []) if a.get("featuredOnHome")]
                ls_handles = [a.get("handle") for a in ls_arts]
                if blog_featured and set(ls_handles) <= set(blog_featured):
                    ok("latest-stories handles subset of blog featuredOnHome")
                elif blog_featured and ls_handles == blog_featured[: len(ls_handles)]:
                    ok("latest-stories order matches blog featured")
                elif blog_featured:
                    warn(f"latest-stories handles differ from blog featured: {ls_handles[:3]}...")
        else:
            bad(f"latest-stories REST bad st={ls_st}")

        # --- Frontend blog pages fetch REST ---
        captcha_clear(page)
        page.goto(urljoin(SITE, "/blogs/news/oem-packaging-guide"), wait_until="domcontentloaded")
        page.wait_for_timeout(4000)
        ready = page.locator("[data-ybb-blog-ready='1']").count() > 0
        h1 = page.locator("article h1").inner_text() if page.locator("article h1").count() else ""
        report["frontend"] = {"articleReady": ready, "h1": h1[:80]}
        if ready and h1:
            ok("article page hydrated from REST/static")
        elif h1 and "OEM Packaging" in h1:
            ok("article page content visible (REST/static)")
        else:
            bad(f"article page not ready ready={ready} h1={h1[:40]}")

        captcha_clear(page)
        page.goto(urljoin(SITE, "/blogs/news.html"), wait_until="domcontentloaded")
        page.wait_for_timeout(4000)
        cards = page.locator(".blog-grid li").count()
        list_ready = page.locator("[data-ybb-blog-ready='1']").count() > 0
        report["frontend"]["listCards"] = cards
        report["frontend"]["listReady"] = list_ready
        if cards >= EXPECTED_ARTICLES and list_ready:
            ok(f"blog index {cards} cards + REST ready flag")
        else:
            bad(f"blog index cards={cards} ready={list_ready}")

        captcha_clear(page)
        page.goto(SITE + "/", wait_until="domcontentloaded")
        page.wait_for_timeout(5000)
        home_cards = page.locator("#latest-stories-heading").locator(
            "xpath=ancestor::section//article"
        ).count()
        if home_cards >= EXPECTED_HOME_FEATURED:
            ok(f"homepage Latest Stories {home_cards} cards after blog REST")
        else:
            bad(f"homepage Latest Stories only {home_cards} cards")

        # Network: article page should have attempted blog REST
        blog_rest_hit = False
        captcha_clear(page)

        def on_response(res):
            nonlocal blog_rest_hit
            if "site-manager/blog" in res.url and res.status == 200:
                blog_rest_hit = True

        page.on("response", on_response)
        page.goto(urljoin(SITE, "/blogs/news/oem-packaging-guide"), wait_until="domcontentloaded")
        page.wait_for_timeout(5000)
        if blog_rest_hit:
            ok("browser fetched /site-manager/blog on article page")
        else:
            warn("did not observe blog REST fetch (may use cache or same bundle)")

        browser.close()

    report["verdict"] = "PASS" if not report["fail"] else "FAIL"
    REPORT.parent.mkdir(parents=True, exist_ok=True)
    REPORT.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")

    print("=== BLOG REST ACCEPTANCE ROUND 2 ===")
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
