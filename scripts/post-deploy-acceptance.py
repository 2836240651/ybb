#!/usr/bin/env python3
"""Global post-deploy acceptance (browser-first, bypasses SG Captcha on CLI)."""
from __future__ import annotations

import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urljoin

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT_INDEX = ROOT / "out" / "index.html"
REPORT_PATH = ROOT / "reports" / "post-deploy-acceptance.json"
SITE = "https://carp-ybb.com"
LOCAL_BUILD_ID = None
if OUT_INDEX.exists():
    m = re.search(r"<!--([^>]+)-->", OUT_INDEX.read_text(encoding="utf-8", errors="ignore"))
    LOCAL_BUILD_ID = m.group(1).strip() if m else None


def pass_sgcaptcha(page) -> None:
    page.goto(SITE, wait_until="domcontentloaded", timeout=90000)
    for _ in range(90):
        if "sgcaptcha" not in page.url:
            return
        page.wait_for_timeout(1000)
    raise RuntimeError(f"Captcha not cleared: {page.url}")


def fetch_json_in_page(page, route: str) -> tuple[int, object | None]:
    url = urljoin(SITE, f"/wp-json{route}")
    legacy = urljoin(SITE, f"/index.php?rest_route={route}")
    for u in (url, legacy):
        try:
            data = page.evaluate(
                """async (u) => {
                  const r = await fetch(u, { credentials: 'same-origin', cache: 'no-store' });
                  const t = await r.text();
                  let j = null;
                  try { j = JSON.parse(t); } catch {}
                  return { status: r.status, json: j, preview: t.slice(0, 200) };
                }""",
                u,
            )
            if data.get("json") is not None:
                return int(data["status"]), data["json"]
            if int(data.get("status", 0)) == 200:
                return 200, None
        except Exception:
            continue
    return 0, None


def extract_build_id(html: str) -> str | None:
    m = re.search(r"<!--([A-Za-z0-9_-]{10,})-->", html)
    if m:
        return m.group(1)
    if LOCAL_BUILD_ID and LOCAL_BUILD_ID in html:
        return LOCAL_BUILD_ID
    return None


def main() -> int:
    report: dict = {
        "at": datetime.now(timezone.utc).isoformat(),
        "site": SITE,
        "localBuildId": LOCAL_BUILD_ID,
        "remoteBuildId": None,
        "routes": {},
        "rest": {},
        "blog": {},
        "assets": {"checked": 0, "failures": []},
        "acceptance": {"pass": [], "fail": [], "warn": []},
    }
    acc = report["acceptance"]

    static_routes = [
        "/",
        "/blogs/news.html",
        "/blogs/news/oem-packaging-guide",
        "/collections/sinkers/",
        "/products/tz-qz-025/",
        "/wp-json/",
    ]

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1440, "height": 900})
        pass_sgcaptcha(page)

        # Homepage + buildId + chunks
        page.goto(SITE + "/", wait_until="domcontentloaded", timeout=90000)
        page.wait_for_load_state("domcontentloaded")
        page.wait_for_timeout(1500)
        home_html = page.content()
        remote_bid = extract_build_id(home_html)
        report["remoteBuildId"] = remote_bid
        if remote_bid and LOCAL_BUILD_ID and remote_bid == LOCAL_BUILD_ID:
            acc["pass"].append(f"buildId match: {remote_bid}")
        elif remote_bid:
            acc["warn"].append(f"buildId remote={remote_bid} local={LOCAL_BUILD_ID}")
        else:
            acc["fail"].append("buildId missing on homepage")

        assets = list(
            dict.fromkeys(
                re.findall(r'(?:src|href)="(/_next/static/[^"?]+)"', home_html)
            )
        )[:30]
        for rel in assets:
            report["assets"]["checked"] += 1
            try:
                res = page.request.get(urljoin(SITE, rel), timeout=60000)
                code = res.status
            except Exception as exc:
                code = 0
                report["assets"]["failures"].append(f"{rel} -> {exc}")
                continue
            if code != 200:
                report["assets"]["failures"].append(f"{rel} -> {code}")
        if not report["assets"]["failures"]:
            acc["pass"].append(f"homepage chunks OK ({report['assets']['checked']} sampled)")
        else:
            acc["fail"].append(f"chunk failures: {report['assets']['failures'][:5]}")

        # Static routes
        for path in static_routes:
            resp = page.goto(urljoin(SITE, path), wait_until="domcontentloaded", timeout=90000)
            page.wait_for_timeout(800)
            code = resp.status if resp else 0
            title = page.title()
            report["routes"][path] = {"status": code, "title": title[:80]}
            if code == 200:
                acc["pass"].append(f"route 200: {path}")
            else:
                acc["fail"].append(f"route {code}: {path}")

        # Blog client shell
        page.goto(urljoin(SITE, "/blogs/news/oem-packaging-guide"), wait_until="domcontentloaded")
        page.wait_for_timeout(2500)
        blog_ready = page.locator("[data-ybb-blog-ready='1']").count()
        has_h1 = page.locator("article h1").count()
        report["blog"]["articleReady"] = blog_ready > 0
        report["blog"]["articleH1"] = has_h1 > 0
        if blog_ready and has_h1:
            acc["pass"].append("blog article client view rendered")
        else:
            acc["warn"].append(f"blog article ready={blog_ready} h1={has_h1}")

        page.goto(urljoin(SITE, "/blogs/news.html"), wait_until="domcontentloaded")
        page.wait_for_timeout(2500)
        list_ready = page.locator("[data-ybb-blog-ready='1']").count()
        cards = page.locator(".blog-grid li").count()
        report["blog"]["listReady"] = list_ready > 0
        report["blog"]["listCards"] = cards
        if list_ready and cards >= 5:
            acc["pass"].append(f"blog index client view ({cards} cards)")
        elif cards >= 5:
            acc["pass"].append(f"blog index static fallback ({cards} cards)")
        else:
            acc["fail"].append(f"blog index thin: ready={list_ready} cards={cards}")

        # REST modules
        rest_checks = {
            "navigation": "/ybb/v1/site-manager/navigation",
            "hero": "/ybb/v1/site-manager/hero",
            "blog": "/ybb/v1/site-manager/blog",
            "latestStories": "/ybb/v1/latest-stories",
            "factoryVideo": "/ybb/v1/site-manager/factory-video",
        }
        for key, route in rest_checks.items():
            status, data = fetch_json_in_page(page, route)
            entry: dict = {"status": status}
            if isinstance(data, dict):
                entry["enabled"] = data.get("enabled")
                if key == "navigation":
                    items = data.get("items") or data.get("navigation") or []
                    entry["count"] = len(items) if isinstance(items, list) else 0
                elif key == "hero":
                    entry["slides"] = len(data.get("slides") or [])
                elif key == "blog":
                    entry["articles"] = len(data.get("articles") or [])
                elif key == "latestStories":
                    arts = data.get("articles") or data.get("stories") or []
                    entry["articles"] = len(arts) if isinstance(arts, list) else 0
                    entry["hasArticlesKey"] = "articles" in data
                elif key == "factoryVideo":
                    entry["hasVideoUrl"] = bool(data.get("videoUrl"))
            report["rest"][key] = entry

            if status != 200:
                acc["fail"].append(f"REST {key} HTTP {status}")
                continue
            if key == "blog" and (entry.get("articles") or 0) == 0:
                acc["warn"].append("REST blog empty �?mu-plugin v1.2.0 not deployed? (static fallback OK)")
            elif key == "latestStories":
                if entry.get("articles", 0) >= 1:
                    acc["pass"].append(f"latest-stories {entry['articles']} articles")
                else:
                    acc["warn"].append("latest-stories empty")
                if not entry.get("hasArticlesKey"):
                    acc["warn"].append("latest-stories missing articles key (legacy home settings?)")
            elif key == "navigation" and (entry.get("count") or 0) >= 4:
                acc["pass"].append(f"navigation REST {entry['count']} items")
            elif key == "hero" and (entry.get("slides") or 0) >= 1:
                acc["pass"].append(f"hero REST {entry['slides']} slides")
            elif key == "factoryVideo":
                acc["pass"].append("factory-video REST OK")
            else:
                acc["pass"].append(f"REST {key} OK")

        # Homepage Latest Stories carousel hydrate
        page.goto(SITE + "/", wait_until="domcontentloaded")
        page.wait_for_timeout(4000)
        stories_ready = page.locator("[data-ybb-stories-ready='1']").count()
        story_cards = page.locator("#latest-stories-heading").locator("xpath=ancestor::section//article").count()
        report["blog"]["homeStoriesReady"] = stories_ready > 0
        report["blog"]["homeStoryCards"] = story_cards
        if stories_ready and story_cards >= 1:
            acc["pass"].append(f"homepage Latest Stories hydrated ({story_cards} cards)")
        elif story_cards >= 1:
            acc["pass"].append(f"homepage Latest Stories visible ({story_cards} cards)")
        else:
            acc["warn"].append("homepage Latest Stories not hydrated yet")

        # Desktop nav triggers
        nav_triggers = page.locator("nav.header-nav-zone button, nav.header-nav-zone a").count()
        mega_triggers = page.locator("nav.header-nav-zone >> text=�?).count()
        report["desktopNav"] = {"items": nav_triggers, "megaTriggers": mega_triggers}
        if nav_triggers >= 6:
            acc["pass"].append(f"desktop nav populated ({nav_triggers} items)")
        else:
            acc["warn"].append(f"desktop nav sparse: {nav_triggers} items")

        browser.close()

    report["verdict"] = "PASS" if not acc["fail"] else "FAIL"
    REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
    REPORT_PATH.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")

    print("=== POST-DEPLOY ACCEPTANCE ===")
    print(f"local buildId:  {LOCAL_BUILD_ID}")
    print(f"remote buildId: {report['remoteBuildId']}")
    print(f"verdict: {report['verdict']}")
    print("--- PASS ---")
    for line in acc["pass"]:
        print(f"  + {line}")
    print("--- WARN ---")
    for line in acc["warn"]:
        print(f"  ? {line}")
    print("--- FAIL ---")
    for line in acc["fail"]:
        print(f"  - {line}")
    print(f"report: {REPORT_PATH}")
    return 0 if report["verdict"] == "PASS" else 1


if __name__ == "__main__":
    raise SystemExit(main())
