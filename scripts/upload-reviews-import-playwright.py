#!/usr/bin/env python3
"""Upload YBB product review import xlsx via WP Admin (Playwright)."""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SKILL_ROOT = ROOT.parents[1]
SECRETS = ROOT / "secrets.local.json"
IMPORT_DIR = SKILL_ROOT / "reports" / "product-reviews-import"
SITE = "https://carp-ybb.com"
REVIEWS_IMPORT_URL = f"{SITE}/wp-admin/admin.php?page=ybb-site-manager&tab=reviews-import"
CDP_URLS = ("http://127.0.0.1:9224", "http://127.0.0.1:9222")
DEFAULT_PROFILE = Path(
    os.environ.get(
        "YBB_WP_CHROME_PROFILE",
        str(Path(os.environ.get("LOCALAPPDATA", "")) / "ybb-wp-admin-chrome-profile"),
    )
)


def captcha_blocked(page) -> bool:
    url = page.url
    try:
        text = page.locator("body").inner_text(timeout=2000)
    except Exception:
        text = ""
    try:
        title = page.title()
    except Exception:
        title = ""
    return (
        "sgcaptcha" in url
        or ".well-known/captcha" in url
        or "Checking the site connection security" in text
        or "requires cookies to be enabled" in text
        or "Robot Challenge" in title
    )


def pass_sgcaptcha(page, wp: dict, *, max_sec: int = 180) -> None:
    site = (wp.get("siteUrl") or SITE).rstrip("/")
    page.goto(site + "/", wait_until="domcontentloaded", timeout=120000)
    for i in range(max_sec):
        if not captcha_blocked(page) and "carp-ybb.com" in page.url:
            return
        if i and i % 15 == 0:
            print(f"[captcha] waiting... {i}s url={page.url}", flush=True)
        page.wait_for_timeout(1000)
    raise RuntimeError(f"SiteGround captcha not cleared after {max_sec}s ({page.url})")


def load_secrets() -> dict:
    if not SECRETS.is_file():
        raise SystemExit(f"Missing secrets: {SECRETS}")
    return json.loads(SECRETS.read_text(encoding="utf-8"))


def ensure_playwright():
    try:
        from playwright.sync_api import sync_playwright
        return sync_playwright
    except ImportError:
        import subprocess
        subprocess.check_call([sys.executable, "-m", "pip", "install", "playwright", "-q"])
        subprocess.check_call([sys.executable, "-m", "playwright", "install", "chromium"])
        from playwright.sync_api import sync_playwright
        return sync_playwright


def maybe_jetpack_captcha(page) -> None:
    captcha = page.locator("#jetpack_protect_answer")
    if not captcha.count():
        return
    label = page.locator('label[for="jetpack_protect_answer"]').inner_text()
    nums = [int(n) for n in re.findall(r"\d+", label)]
    if len(nums) >= 2:
        captcha.fill(str(nums[0] + nums[1]))


def ensure_single_page(context):
    """Use one tab only — close extras from profile restore or CDP."""
    pages = list(context.pages)
    preferred = None
    for candidate in pages:
        url = candidate.url or ""
        if "wp-admin" in url or "wp-login" in url or "carp-ybb.com" in url:
            preferred = candidate
            break
    page = preferred or (pages[0] if pages else context.new_page())
    for extra in pages:
        if extra is page:
            continue
        try:
            extra.close()
        except Exception:
            pass
    return page


def dashboard_url(wp: dict) -> str:
    admin = (wp.get("adminUrl") or f"{SITE}/wp-admin").rstrip("/")
    return f"{admin}/index.php"


def goto_reviews_import(page, wp: dict) -> None:
    """Navigate the current tab to YBB 站点管理 → 评价导入."""
    page.goto(REVIEWS_IMPORT_URL, wait_until="domcontentloaded", timeout=120000)
    page.wait_for_timeout(2000)
    if captcha_blocked(page):
        pass_sgcaptcha(page, wp)
        page.goto(REVIEWS_IMPORT_URL, wait_until="domcontentloaded", timeout=120000)
        page.wait_for_timeout(2000)

    panel = page.locator(".ybb-pr-import-admin")
    if not panel.count():
        fallback_url = f"{SITE}/wp-admin/admin.php?page=ybb-reviews-import"
        page.goto(fallback_url, wait_until="domcontentloaded", timeout=120000)
        page.wait_for_timeout(2000)
        panel = page.locator(".ybb-pr-import-admin")

    panel.first.wait_for(state="visible", timeout=60000)
    panel.first.scroll_into_view_if_needed(timeout=30000)
    print(f"[nav] reviews-import ready: {page.url}", flush=True)


def scrape_import_nonce(page) -> tuple[str, str]:
    html = page.content()
    nonce_m = re.search(r'name="_wpnonce"\s+value="([^"]+)"', html)
    referer_m = re.search(r'name="_wp_http_referer"\s+value="([^"]*)"', html)
    if not nonce_m:
        raise RuntimeError("ybb_pr_import nonce not found on reviews-import page")
    return nonce_m.group(1), referer_m.group(1) if referer_m else page.url


def cancel_preview_if_needed(page) -> None:
    if not page.locator(".ybb-pr-import-admin table.widefat").count():
        return
    cancel_btn = page.locator('.ybb-pr-import-admin form[method="get"] input[type="submit"]').first
    if not cancel_btn.count():
        return
    with page.expect_navigation(wait_until="domcontentloaded", timeout=60000):
        cancel_btn.click(force=True)
    page.wait_for_timeout(1000)


def submit_preview_request(page, xlsx: Path) -> None:
    """Attach file with Playwright, submit the admin preview form once."""
    page.set_default_timeout(600000)
    upload_form = page.locator(
        '.ybb-pr-import-admin form[enctype="multipart/form-data"]'
    ).first
    file_input = upload_form.locator('input[name="import_file"]')
    file_input.set_input_files(str(xlsx.resolve()))
    files_len = page.evaluate(
        """() => {
            const el = document.querySelector('.ybb-pr-import-admin input[name="import_file"]');
            return el && el.files ? el.files.length : -1;
        }"""
    )
    if files_len != 1:
        raise RuntimeError(f"file input not attached (files.length={files_len})")
    submit = upload_form.locator('input[type="submit"]').first
    submit.scroll_into_view_if_needed(timeout=30000)
    with page.expect_navigation(wait_until="domcontentloaded", timeout=600000):
        submit.click(force=True)
    page.wait_for_timeout(3000)
    has_table = page.locator(".ybb-pr-import-admin table.widefat").count() > 0
    panel = page.locator(".ybb-pr-import-admin").first
    body = panel.inner_text()
    err = ""
    if panel.locator(".notice-error").count():
        err = panel.locator(".notice-error").first.inner_text().strip()
    importable_m = re.search(r"可导入\s*(\d+)", body)
    print(
        f"[preview] submitted table={has_table} importable={importable_m.group(1) if importable_m else 0} err={err[:120]}",
        flush=True,
    )


def submit_confirm_request(page) -> None:
    """Click confirm import on the preview form."""
    confirm_form = page.locator(
        '.ybb-pr-import-admin form:has(input[name="ybb_pr_step"][value="import"])'
    ).first
    confirm = confirm_form.locator('input[type="submit"]').first
    page.set_default_timeout(600000)
    with page.expect_navigation(wait_until="domcontentloaded", timeout=600000):
        confirm.click(force=True)
    page.wait_for_timeout(3000)


def import_form(page):
    """Scope to the 评价导入 upload form (avoid other wp-admin submit buttons)."""
    return page.locator(".ybb-pr-import-admin form").filter(
        has=page.locator('input[type="file"][name="import_file"]')
    ).first


def login_wp(page, wp: dict) -> None:
    """Pass captcha, log in once, land on wp-admin dashboard (no import tab yet)."""
    pass_sgcaptcha(page, wp)
    target = dashboard_url(wp)
    page.goto(target, wait_until="domcontentloaded", timeout=120000)
    page.wait_for_timeout(1500)

    if captcha_blocked(page):
        pass_sgcaptcha(page, wp)
        page.goto(target, wait_until="domcontentloaded", timeout=120000)
        page.wait_for_timeout(1500)

    if "wp-login" in page.url or page.locator("#loginform").count():
        user = wp.get("username") or wp.get("email") or ""
        password = wp.get("password") or ""
        if not user or not password:
            raise RuntimeError("wordpress.username/email or password missing in secrets.local.json")
        page.fill("#user_login", user)
        page.fill("#user_pass", password)
        maybe_jetpack_captcha(page)
        page.click("#wp-submit")
        page.wait_for_load_state("domcontentloaded", timeout=120000)
        page.wait_for_timeout(2000)
        if "wp-admin" not in page.url:
            page.goto(target, wait_until="domcontentloaded", timeout=120000)
            page.wait_for_timeout(1500)

    if captcha_blocked(page):
        pass_sgcaptcha(page, wp)
        page.goto(target, wait_until="domcontentloaded", timeout=120000)
        page.wait_for_timeout(1500)

    if "wp-login" in page.url:
        raise RuntimeError(f"WP login failed, still at {page.url}")

    print(f"[login] dashboard ready: {page.url}", flush=True)


def import_one_file(page, xlsx: Path, wp: dict) -> dict:
    if not xlsx.is_file():
        raise FileNotFoundError(xlsx)

    goto_reviews_import(page, wp)
    cancel_preview_if_needed(page)

    if not page.locator(".ybb-pr-import-admin").count():
        body = page.locator("body").inner_text()
        return {
            "file": xlsx.name,
            "status": "error",
            "message": "评价导入面板未加载。body=" + body[:300],
        }

    print(f"[preview] uploading {xlsx.name} ...", flush=True)
    submit_preview_request(page, xlsx)

    try:
        page.locator(".ybb-pr-import-admin table.widefat").first.wait_for(
            state="visible", timeout=120000
        )
    except Exception:
        pass

    panel = page.locator(".ybb-pr-import-admin")
    body = panel.first.inner_text() if panel.count() else page.inner_text("body")
    if "文件中没有可导入的数据行" in body or "预览已过期" in body:
        return {"file": xlsx.name, "status": "error", "message": body[:500]}
    if page.locator(".ybb-pr-import-admin .notice-error").count():
        err = page.locator(".ybb-pr-import-admin .notice-error").first.inner_text()
        return {"file": xlsx.name, "status": "error", "message": err[:500]}

    importable_m = re.search(r"可导入\s*(\d+)", body)
    importable = int(importable_m.group(1)) if importable_m else 0
    if importable <= 0 or not page.locator(
        '.ybb-pr-import-admin input[name="ybb_pr_step"][value="import"]'
    ).count():
        return {"file": xlsx.name, "status": "preview_only", "message": body[:800]}

    print(f"[import] confirming {importable} rows ...", flush=True)
    submit_confirm_request(page)

    panel = page.locator(".ybb-pr-import-admin")
    result_text = panel.first.inner_text() if panel.count() else page.inner_text("body")
    ok_m = re.search(r"导入完成：成功\s*(\d+)", result_text)
    return {
        "file": xlsx.name,
        "status": "imported",
        "ok": int(ok_m.group(1)) if ok_m else None,
        "message": (result_text[:600] if "导入完成" in result_text else result_text[:400]),
    }


def connect_page(sync_playwright, *, headless: bool, use_cdp: bool, profile: Path | None):
    p = sync_playwright

    def try_cdp():
        for cdp_url in CDP_URLS:
            try:
                browser = p.chromium.connect_over_cdp(cdp_url)
                context = browser.contexts[0] if browser.contexts else browser.new_context()
                page = ensure_single_page(context)
                print(f"[browser] CDP {cdp_url} (single tab)", flush=True)
                return browser, page, True
            except Exception:
                continue
        return None

    if use_cdp:
        hit = try_cdp()
        if hit:
            return hit
        raise SystemExit(
            "CDP not available on :9224/:9222. Run: node scripts/open-wp-admin-chrome.mjs"
        )

    if profile and profile.is_dir():
        print(f"[browser] Chrome profile {profile}", flush=True)
        try:
            context = p.chromium.launch_persistent_context(
                str(profile),
                headless=headless,
                channel="chrome",
                viewport={"width": 1440, "height": 900},
                args=["--disable-session-crashed-bubble"],
            )
            page = ensure_single_page(context)
            return context, page, False
        except Exception as exc:
            print(f"[browser] profile busy ({exc!r}), trying CDP ...", flush=True)
            hit = try_cdp()
            if hit:
                return hit

    browser = p.chromium.launch(headless=headless, channel="chrome")
    context = browser.new_context(viewport={"width": 1440, "height": 900})
    page = context.new_page()
    print("[browser] ephemeral Chrome (single tab)", flush=True)
    return browser, page, False


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--file",
        action="append",
        help="Import xlsx path (repeatable). Default: batch1+batch2 for today",
    )
    parser.add_argument("--headless", action="store_true")
    parser.add_argument(
        "--use-cdp",
        action="store_true",
        help="Connect to Chrome on :9224/:9222 (run open-wp-admin-chrome.mjs first)",
    )
    parser.add_argument(
        "--profile",
        default=str(DEFAULT_PROFILE),
        help="Persistent Chrome profile when not using CDP",
    )
    args = parser.parse_args()

    stamp = time.strftime("%Y%m%d")
    default_files = [
        IMPORT_DIR / f"all-products-reviews-import-batch1-{stamp}.xlsx",
        IMPORT_DIR / f"all-products-reviews-import-batch2-{stamp}.xlsx",
    ]
    files = [Path(f) for f in args.file] if args.file else default_files
    missing = [str(f) for f in files if not f.is_file()]
    if missing:
        fallback = IMPORT_DIR / f"all-products-reviews-import-{stamp}-new.xlsx"
        if not args.file and fallback.is_file():
            files = [fallback]
        elif missing:
            raise SystemExit("Missing files:\n" + "\n".join(missing))

    secrets = load_secrets()
    wp = secrets.get("wordpress") or {}

    sync_playwright = ensure_playwright()
    profile = Path(args.profile) if args.profile else None
    results = []
    with sync_playwright() as p:
        handle, page, is_cdp = connect_page(
            p,
            headless=args.headless,
            use_cdp=args.use_cdp,
            profile=profile,
        )
        login_wp(page, wp)
        for xlsx in files:
            print(f"IMPORT {xlsx.name} ...", flush=True)
            try:
                result = import_one_file(page, xlsx, wp)
            except Exception as exc:
                result = {"file": xlsx.name, "status": "error", "message": str(exc)}
            results.append(result)
            try:
                print(json.dumps(result, ensure_ascii=False), flush=True)
            except UnicodeEncodeError:
                print(json.dumps(result, ensure_ascii=True), flush=True)
        if not is_cdp:
            handle.close()

    out = IMPORT_DIR / f"reviews-import-playwright-result-{stamp}.json"
    out.write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")
    print(out)


if __name__ == "__main__":
    main()
