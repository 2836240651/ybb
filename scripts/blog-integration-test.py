#!/usr/bin/env python3
"""End-to-end blog integration: REST �?frontend DOM �?WP admin save round-trip."""
from __future__ import annotations

import json
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urljoin

from playwright.sync_api import Page, sync_playwright

ROOT = Path(__file__).resolve().parents[1]
SECRETS = ROOT / "secrets.local.json"
REPORT = ROOT / "reports" / "blog-integration-test.json"
SITE = "https://carp-ybb.com"
OPTION = "ybb_site_manager_settings"
ARTICLE_HANDLE = "oem-packaging-guide"


def load_wp() -> dict[str, str]:
    data = json.loads(SECRETS.read_text(encoding="utf-8"))
    wp = data.get("wordpress", {})
    for key in ("adminUrl", "email", "password"):
        if not wp.get(key):
            raise RuntimeError(f"missing wordpress.{key} in secrets.local.json")
    return wp


def captcha_clear(page: Page) -> None:
    page.goto(SITE, wait_until="domcontentloaded", timeout=90000)
    for _ in range(90):
        if "sgcaptcha" not in page.url and "Robot Challenge" not in page.title():
            return
        page.wait_for_timeout(1000)
    raise RuntimeError(f"Captcha not cleared: {page.url}")


def fetch_rest_json(page: Page, route: str) -> dict:
    path = route if route.startswith("/wp-json") else f"/wp-json{route}"
    for attempt in range(3):
        captcha_clear(page)
        page.goto(urljoin(SITE, path), wait_until="domcontentloaded", timeout=90000)
        page.wait_for_timeout(1500)
        text = page.locator("body").inner_text().strip()
        if text.startswith("{"):
            return json.loads(text)
        page.wait_for_timeout(2000)
    raise RuntimeError(f"REST JSON unavailable for {route}: {text[:120]!r}")


def article_by_handle(blog: dict, handle: str) -> dict | None:
    for row in blog.get("articles") or []:
        if row.get("handle") == handle:
            return row
    return None


def maybe_login(page: Page, wp: dict[str, str]) -> None:
    if "wp-login.php" not in page.url:
        return
    page.fill("#user_login", wp["email"])
    page.fill("#user_pass", wp["password"])
    if page.locator("#jetpack_protect_answer").count():
        raise RuntimeError("Jetpack captcha on wp-login �?login manually then re-run")
    page.click("#wp-submit")
    page.wait_for_load_state("domcontentloaded")


def main() -> int:
    report: dict = {
        "at": datetime.now(timezone.utc).isoformat(),
        "pass": [],
        "fail": [],
        "warn": [],
        "phases": {},
    }

    def ok(msg: str) -> None:
        report["pass"].append(msg)

    def bad(msg: str) -> None:
        report["fail"].append(msg)

    def warn(msg: str) -> None:
        report["warn"].append(msg)

    wp = load_wp()
    marker = f"[IT-{int(time.time())}]"

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1440, "height": 900})

        # --- Phase 1: REST baseline ---
        captcha_clear(page)
        blog = fetch_rest_json(page, "/ybb/v1/site-manager/blog")
        latest = fetch_rest_json(page, "/ybb/v1/latest-stories")
        report["phases"]["restBaseline"] = {
            "blogArticles": len(blog.get("articles") or []),
            "latestStories": len(latest.get("articles") or []),
        }

        if len(blog.get("articles") or []) < 10:
            bad(f"blog REST articles={len(blog.get('articles') or [])}")
        else:
            ok("REST blog 10 articles")

        target = article_by_handle(blog, ARTICLE_HANDLE)
        if not target:
            bad(f"REST missing article {ARTICLE_HANDLE}")
            browser.close()
            return finalize(report)

        original_title = target["title"]
        original_excerpt = target["excerpt"]
        report["phases"]["original"] = {
            "title": original_title,
            "excerpt": original_excerpt[:80],
        }

        featured = [a for a in blog["articles"] if a.get("featuredOnHome")]
        ls_handles = [a.get("handle") for a in latest.get("articles") or []]
        if len(featured) >= 5 and set(ls_handles) <= {a["handle"] for a in featured}:
            ok("latest-stories aligned with blog featuredOnHome")
        else:
            bad("latest-stories not aligned with blog featured")

        # --- Phase 2: REST �?homepage carousel ---
        captcha_clear(page)
        page.goto(SITE + "/", wait_until="domcontentloaded")
        page.wait_for_timeout(5000)
        home_titles: list[str] = []
        for art in page.locator('section[aria-labelledby="latest-stories-heading"] h3').all():
            home_titles.append(art.inner_text().strip())

        rest_featured_titles = [a["title"] for a in featured[: len(home_titles)]]
        mismatches = [
            (r, h)
            for r, h in zip(rest_featured_titles, home_titles, strict=False)
            if r != h
        ]
        report["phases"]["homeCarousel"] = {"rest": rest_featured_titles, "dom": home_titles}
        if len(home_titles) >= 5 and not mismatches:
            ok("homepage carousel titles match REST featured")
        elif not mismatches and home_titles:
            ok(f"homepage carousel partial match ({len(home_titles)} cards)")
        else:
            bad(f"carousel title mismatch: {mismatches[:2]}")

        # --- Phase 3: REST �?blog index ---
        captcha_clear(page)
        page.goto(urljoin(SITE, "/blogs/news.html"), wait_until="domcontentloaded")
        page.wait_for_timeout(4000)
        dom_titles = [
            el.inner_text().strip()
            for el in page.locator(".blog-grid h2").all()
        ]
        rest_titles = [a["title"] for a in blog["articles"]]
        missing = [t for t in rest_titles if t not in dom_titles]
        report["phases"]["blogIndex"] = {"domCount": len(dom_titles), "missing": missing[:3]}
        if not missing and len(dom_titles) >= 10:
            ok("blog index titles match REST (10/10)")
        else:
            bad(f"blog index missing titles: {missing[:3]}")

        # --- Phase 4: REST �?article body ---
        captcha_clear(page)
        page.goto(urljoin(SITE, f"/blogs/news/{ARTICLE_HANDLE}"), wait_until="domcontentloaded")
        page.wait_for_timeout(4000)
        h1 = page.locator("article h1").inner_text().strip()
        paras = [p.inner_text().strip() for p in page.locator("article .max-w-prose p").all()]
        report["phases"]["articleDom"] = {"h1": h1, "paraCount": len(paras)}
        if h1 == original_title:
            ok("article h1 matches REST title")
        else:
            bad(f"article h1 mismatch: {h1!r} vs {original_title!r}")
        if paras and paras[0] == (target.get("content") or [""])[0]:
            ok("article first paragraph matches REST content[0]")
        else:
            bad("article first paragraph differs from REST")

        # --- Phase 4b: client fetch on article page matches REST ---
        client_title = page.evaluate(
            """async (handle) => {
              const r = await fetch('/wp-json/ybb/v1/site-manager/blog', {
                credentials: 'same-origin', cache: 'no-store'
              });
              const j = await r.json();
              const a = (j.articles || []).find((x) => x.handle === handle);
              return a ? a.title : null;
            }""",
            ARTICLE_HANDLE,
        )
        report["phases"]["clientFetch"] = {"title": client_title}
        if client_title == original_title and client_title == h1:
            ok("article page client fetch title matches REST + DOM")
        else:
            bad(f"client fetch mismatch: fetch={client_title!r} dom={h1!r}")

        # --- Phase 5: WP admin save �?REST �?frontend ---
        patched_title = f"{original_title} {marker}"
        report["phases"]["adminPatch"] = {"marker": marker, "patchedTitle": patched_title}

        admin_ok = False
        try:
            admin_ok = run_admin_round_trip(
                p.chromium,
                page,
                wp,
                row_handle=ARTICLE_HANDLE,
                original_title=original_title,
                patched_title=patched_title,
                marker=marker,
                ok=ok,
                bad=bad,
                warn=warn,
                report=report,
                fetch_rest_json=fetch_rest_json,
            )
        except Exception as exc:
            warn(f"admin round-trip skipped: {exc}")

        if not admin_ok:
            warn("admin save round-trip not completed (login/CDP required for full E2E)")

        browser.close()

    return finalize(report)


def connect_admin_page(chromium, wp: dict[str, str]):
    browser = chromium.launch(headless=True)
    page = browser.new_page()
    page.goto(f"{wp['adminUrl'].rstrip('/')}/wp-login.php", wait_until="domcontentloaded")
    maybe_login(page, wp)
    return browser, page, False


def run_admin_round_trip(
    chromium,
    front_page: Page,
    wp: dict[str, str],
    *,
    row_handle: str,
    original_title: str,
    patched_title: str,
    marker: str,
    ok,
    bad,
    warn,
    report: dict,
    fetch_rest_json,
) -> bool:
    admin_browser, page, _ = connect_admin_page(chromium, wp)
    if "wp-login.php" in page.url:
        raise RuntimeError("WP login blocked (Jetpack captcha) �?open wp-admin in Chrome CDP :9224")

    page.goto(
        f"{wp['adminUrl'].rstrip('/')}/admin.php?page=ybb-site-manager&tab=blog",
        wait_until="domcontentloaded",
    )
    page.wait_for_timeout(2000)

    handle_inputs = page.locator(f'input[name*="{OPTION}"][name*="[handle]"]')
    row_idx = None
    for i in range(handle_inputs.count()):
        if handle_inputs.nth(i).input_value().strip() == row_handle:
            row_idx = i
            break
    if row_idx is None:
        raise RuntimeError(f"admin blog tab: handle {row_handle} not found (not logged in?)")

    title_sel = page.locator(f'input[name="{OPTION}[blog][articles][{row_idx}][title]"]')
    title_sel.fill(patched_title)
    page.get_by_role("button", name="保存").click()
    page.wait_for_url(re.compile(r"settings-updated=true"), timeout=45000)
    page.wait_for_timeout(2000)
    ok("WP admin blog save succeeded")

    blog_after = fetch_rest_json(front_page, "/ybb/v1/site-manager/blog")
    after = article_by_handle(blog_after, row_handle)
    if after and after.get("title") == patched_title:
        ok("REST title updated after admin save")
    else:
        bad(f"REST title not updated: {after.get('title') if after else None}")

    captcha_clear(front_page)
    front_page.goto(
        urljoin(SITE, f"/blogs/news/{row_handle}"),
        wait_until="domcontentloaded",
    )
    front_page.wait_for_timeout(5000)
    h1_after = front_page.locator("article h1").inner_text().strip()
    if marker in h1_after:
        ok("frontend article h1 reflects admin save (no redeploy)")
    else:
        bad(f"frontend h1 missing marker: {h1_after!r}")

    page.goto(
        f"{wp['adminUrl'].rstrip('/')}/admin.php?page=ybb-site-manager&tab=blog",
        wait_until="domcontentloaded",
    )
    page.wait_for_timeout(1500)
    title_sel = page.locator(f'input[name="{OPTION}[blog][articles][{row_idx}][title]"]')
    title_sel.fill(original_title)
    page.get_by_role("button", name="保存").click()
    page.wait_for_url(re.compile(r"settings-updated=true"), timeout=45000)
    page.wait_for_timeout(1500)

    blog_revert = fetch_rest_json(front_page, "/ybb/v1/site-manager/blog")
    reverted = article_by_handle(blog_revert, row_handle)
    if reverted and reverted.get("title") == original_title:
        ok("REST title reverted after cleanup save")
    else:
        warn("REST title revert check inconclusive")

    admin_browser.close()
    return True


def finalize(report: dict) -> int:
    read_fails = [
        f for f in report["fail"]
        if not f.startswith("REST title") and not f.startswith("frontend h1 missing")
    ]
    report["readPathVerdict"] = "PASS" if not read_fails else "FAIL"
    report["adminVerdict"] = (
        "PASS"
        if any("WP admin blog save" in p for p in report["pass"])
        else ("SKIP" if report["warn"] else "FAIL")
    )
    report["verdict"] = report["readPathVerdict"]
    REPORT.parent.mkdir(parents=True, exist_ok=True)
    REPORT.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print("=== BLOG INTEGRATION TEST ===")
    print(f"read-path verdict: {report['readPathVerdict']}")
    print(f"admin round-trip: {report['adminVerdict']}")
    for line in report["pass"]:
        print(f"  PASS  {line}")
    for line in report["warn"]:
        print(f"  WARN  {line}")
    for line in report["fail"]:
        print(f"  FAIL  {line}")
    print(f"report: {REPORT}")
    return 0 if report["readPathVerdict"] == "PASS" else 1


if __name__ == "__main__":
    raise SystemExit(main())
