#!/usr/bin/env python3
"""Full-page network capture + homepage header nav acceptance on production."""
from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
REPORT = ROOT / "reports" / "home-nav-acceptance-capture.json"
SITE = "https://carp-ybb.com"

EXPECTED_TOP_LEVEL_ZH = [
    "2026新品",
    "铅坠",
    "饵笼",
    "线组",
    "欧鲤鱼钩",
    "套盒-欧鲤�?,
    "配件",
    "OEM / ODM",
]

MEGA_GROUPS = {
    "铅坠": ["铅坠", "铅坠钓组"],
    "饵笼": ["饵笼钓组", "饵笼"],
    "配件": ["配件金属", "配件塑料", "支架", "周边设备"],
    "OEM / ODM": ["Private Label", "Custom Packaging", "MOQ & Lead Time"],
}


def pass_sgcaptcha(page) -> None:
    page.goto(SITE, wait_until="domcontentloaded", timeout=90000)
    for _ in range(60):
        if "sgcaptcha" not in page.url:
            return
        page.wait_for_timeout(1000)
    raise RuntimeError(f"Captcha not cleared: {page.url}")


def main() -> int:
    network: list[dict] = []
    report: dict = {
        "at": datetime.now(timezone.utc).isoformat(),
        "url": SITE + "/",
        "buildId": None,
        "rest": {},
        "sessionStorage": {},
        "desktop": {},
        "mobile": {},
        "megaHover": {},
        "video": {},
        "networkSummary": {},
        "acceptance": {"pass": [], "fail": [], "warn": []},
    }

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        desktop = browser.new_page(viewport={"width": 1440, "height": 900})

        def on_request(req):
            network.append(
                {
                    "phase": "request",
                    "method": req.method,
                    "url": req.url,
                    "resourceType": req.resource_type,
                }
            )

        def on_response(res):
            url = res.url
            entry = {
                "phase": "response",
                "status": res.status,
                "url": url,
                "contentType": res.headers.get("content-type", ""),
            }
            if "/ybb/v1/" in url or "rest_route=" in url:
                try:
                    if "json" in entry["contentType"]:
                        entry["body"] = res.json()
                except Exception as exc:
                    entry["parseError"] = str(exc)
            network.append(entry)

        desktop.on("request", on_request)
        desktop.on("response", on_response)

        pass_sgcaptcha(desktop)
        desktop.goto(f"{SITE}/?lang=zh", wait_until="domcontentloaded", timeout=90000)
        for _ in range(60):
            if "sgcaptcha" not in desktop.url:
                break
            desktop.wait_for_timeout(1000)
        desktop.wait_for_timeout(5000)

        html = ""
        for attempt in range(8):
            try:
                html = desktop.content()
                break
            except Exception:
                desktop.wait_for_timeout(1500)
        if not html:
            raise RuntimeError("Could not read page content after navigation")
        m = re.search(r"<!DOCTYPE html><!--([^>]+)-->", html, re.I)
        report["buildId"] = m.group(1) if m else None

        rest_nav = desktop.evaluate(
            """async () => {
              const r = await fetch('/wp-json/ybb/v1/site-manager/navigation', {
                headers: { Accept: 'application/json' },
                credentials: 'same-origin',
              });
              return { status: r.status, body: await r.json() };
            }"""
        )
        rest_video = desktop.evaluate(
            """async () => {
              const r = await fetch('/wp-json/ybb/v1/site-manager/factory-video', {
                headers: { Accept: 'application/json' },
                credentials: 'same-origin',
              });
              return { status: r.status, body: await r.json() };
            }"""
        )
        report["rest"]["navigation"] = rest_nav
        report["rest"]["factoryVideo"] = rest_video

        report["sessionStorage"] = desktop.evaluate(
            """() => {
              const keys = Object.keys(sessionStorage).filter(k => k.includes('ybb'));
              const out = {};
              for (const k of keys) {
                try { out[k] = JSON.parse(sessionStorage.getItem(k)); }
                catch { out[k] = sessionStorage.getItem(k); }
              }
              return out;
            }"""
        )

        nav_dom = desktop.evaluate(
            """() => {
              const items = [...document.querySelectorAll('.header-nav-list > li')].map(li => {
                const btn = li.querySelector('button');
                const link = li.querySelector('a');
                return {
                  text: (btn || link)?.textContent?.trim().replace(/�?g, '') || '',
                  isTrigger: !!btn,
                  href: link?.getAttribute('href') || null,
                };
              });
              return { count: items.length, items };
            }"""
        )
        report["desktop"]["navDom"] = nav_dom

        video_dom = desktop.evaluate(
            """() => {
              const sec = document.querySelector('[aria-labelledby="factory-video-heading"]');
              const h = sec?.querySelector('h2');
              const p = sec?.querySelector('p');
              const cta = sec?.querySelector('a[href*="/pages/contact"]');
              return {
                busy: sec?.getAttribute('aria-busy') === 'true',
                title: h?.textContent?.trim() || null,
                body: p?.textContent?.trim()?.slice(0, 80) || null,
                cta: cta?.textContent?.trim() || null,
                hasSkeleton: !!sec?.querySelector('.animate-pulse'),
              };
            }"""
        )
        report["video"]["dom"] = video_dom

        mega_hover: dict = {}
        for label_zh in ("铅坠", "饵笼", "配件", "OEM / ODM"):
            trigger = desktop.locator(".header-nav-list button").filter(
                has_text=re.compile(label_zh)
            )
            if trigger.count() == 0:
                mega_hover[label_zh] = {"open": False, "error": "trigger not found"}
                continue
            trigger.first.hover()
            desktop.wait_for_timeout(600)
            panel = desktop.evaluate(
                """() => {
                  const panel = document.querySelector('.mega-menu-panel--open');
                  const links = panel
                    ? [...panel.querySelectorAll('a[href]')].map(a => ({
                        text: a.textContent?.trim() || '',
                        href: a.getAttribute('href'),
                      }))
                    : [];
                  return {
                    panelOpen: !!panel,
                    linkCount: links.length,
                    links: links.slice(0, 12),
                  };
                }"""
            )
            mega_hover[label_zh] = panel
            desktop.mouse.move(0, 0)
            desktop.wait_for_timeout(200)
        report["megaHover"] = mega_hover

        mobile = browser.new_page(viewport={"width": 390, "height": 844})
        pass_sgcaptcha(mobile)
        mobile.goto(f"{SITE}/?lang=zh", wait_until="domcontentloaded", timeout=90000)
        for _ in range(60):
            if "sgcaptcha" not in mobile.url:
                break
            mobile.wait_for_timeout(1000)
        mobile.wait_for_timeout(4000)
        mobile.locator('button[aria-label*="菜单"], button[aria-label*="Menu"], button[aria-label*="メニュー"], button[aria-label*="打开"]').first.click()
        mobile.wait_for_timeout(800)
        mobile_nav = mobile.evaluate(
            """() => {
              const drawer = document.querySelector('.mobile-nav-drawer--open');
              const top = drawer
                ? [...drawer.querySelectorAll('.mobile-nav-item > button, .mobile-nav-item > a')].map(el => el.textContent?.trim())
                : [];
              return { drawerOpen: !!drawer, topLevel: top };
            }"""
        )
        report["mobile"]["navDrawer"] = mobile_nav
        browser.close()

    # Network summary
    ybb_calls = [n for n in network if n.get("phase") == "response" and "/ybb/v1/" in n.get("url", "")]
    report["networkSummary"] = {
        "totalEvents": len(network),
        "ybbRestResponses": [
            {
                "status": c.get("status"),
                "url": urlparse(c["url"]).path,
                "hasBody": "body" in c,
            }
            for c in ybb_calls
        ],
        "captchaBlocked": sum(1 for n in network if n.get("status") == 202),
    }
    report["network"] = [n for n in network if "/ybb/v1/" in n.get("url", "") or n.get("status") == 202][:80]

    # Acceptance checks
    acc = report["acceptance"]
    nav_body = rest_nav.get("body", {})
    primary = nav_body.get("primaryNav", [])

    if rest_nav.get("status") == 200 and len(primary) == 8:
        acc["pass"].append("REST navigation: 8 primaryNav items")
    else:
        acc["fail"].append(
            f"REST navigation: status={rest_nav.get('status')} count={len(primary)}"
        )

    rest_labels = [i.get("labels", {}).get("zh") or i.get("label") for i in primary]
    if rest_labels == EXPECTED_TOP_LEVEL_ZH:
        acc["pass"].append("REST top-level zh labels match spec")
    else:
        acc["fail"].append(f"REST zh labels: {rest_labels}")

    mega_count = sum(1 for i in primary if i.get("megaMenu"))
    if mega_count == 4:
        acc["pass"].append("REST: 4 megaMenu groups")
    else:
        acc["fail"].append(f"REST megaMenu count={mega_count}")

    for item in primary:
        mega = item.get("megaMenu")
        if mega and mega.get("variant") not in ("category", "oem"):
            acc["fail"].append(f"Invalid mega variant: {item.get('label')}")

    if nav_dom.get("count") == 8:
        acc["pass"].append("Desktop DOM: 8 top-level nav items")
    else:
        acc["fail"].append(f"Desktop DOM nav count={nav_dom.get('count')}")

    triggers = [i for i in nav_dom.get("items", []) if i.get("isTrigger")]
    if len(triggers) == 4:
        acc["pass"].append("Desktop DOM: 4 mega triggers (�?")
    else:
        acc["fail"].append(f"Desktop DOM mega triggers={len(triggers)}")

    flat_old = {"铅坠钓组", "饵笼钓组", "其他"}
    dom_texts = {i.get("text", "") for i in nav_dom.get("items", [])}
    leaked = flat_old & dom_texts
    if not leaked:
        acc["pass"].append("No flat legacy items (铅坠钓组/饵笼钓组/其他) in top bar")
    else:
        acc["fail"].append(f"Legacy flat items in top bar: {leaked}")

    vid_labels = rest_video.get("body", {}).get("labels", {})
    if vid_labels.get("body", {}).get("zh", "").startswith("走进生产"):
        acc["pass"].append("REST video body.zh correct")
    else:
        acc["fail"].append("REST video body.zh missing or wrong")

    if video_dom.get("title") and "Precision Manufacturing" not in (video_dom.get("title") or ""):
        acc["pass"].append("DOM video title not English fallback")
    elif video_dom.get("busy"):
        acc["warn"].append("Video section still aria-busy at capture time")
    else:
        acc["fail"].append(f"DOM video title looks like fallback: {video_dom.get('title')}")

    cache_v3 = report["sessionStorage"].get("ybb:site-manager:navigation:v3")
    if cache_v3:
        acc["pass"].append("sessionStorage nav cache v3 present")
    else:
        acc["warn"].append("sessionStorage nav cache v3 not set yet")

    for group, children in MEGA_GROUPS.items():
        hover = mega_hover.get(group, {})
        if hover.get("linkCount", 0) >= len(children):
            acc["pass"].append(f"Hover {group}: drawer links visible ({hover.get('linkCount')})")
        else:
            acc["warn"].append(
                f"Hover {group}: expected >={len(children)} links, got {hover.get('linkCount')}"
            )

    if mobile_nav.get("drawerOpen") and len(mobile_nav.get("topLevel", [])) == 8:
        acc["pass"].append("Mobile drawer: 8 top-level items")
    elif mobile_nav.get("drawerOpen"):
        acc["warn"].append(f"Mobile drawer top-level count={len(mobile_nav.get('topLevel', []))}")
    else:
        acc["fail"].append("Mobile nav drawer did not open")

    report["verdict"] = (
        "PASS"
        if not acc["fail"]
        else "FAIL"
    )

    REPORT.parent.mkdir(parents=True, exist_ok=True)
    REPORT.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({"verdict": report["verdict"], "report": str(REPORT), "pass": len(acc["pass"]), "fail": len(acc["fail"]), "warn": len(acc["warn"])}, ensure_ascii=False))
    for line in acc["pass"]:
        print(f"  PASS {line}")
    for line in acc["warn"]:
        print(f"  WARN {line}")
    for line in acc["fail"]:
        print(f"  FAIL {line}")
    return 0 if report["verdict"] == "PASS" else 1


if __name__ == "__main__":
    raise SystemExit(main())
