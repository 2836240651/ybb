#!/usr/bin/env python3
"""
Fetch Woo Store API products: Playwright clears SG Captcha, curl fetches JSON (concurrent).

Usage:
  py scripts/sync-from-wp-playwright.py --fetch-variations
  py scripts/sync-from-wp-playwright.py --fetch-variations --skip-sync --workers 10
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

from playwright.sync_api import sync_playwright

sys.path.insert(0, str(Path(__file__).resolve().parent))
from woo_store_fetch import (
    cookies_header,
    fetch_product_pages,
    fetch_variable_details,
)

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_CACHE = ROOT / "reports" / "woo-store-products-cache.json"
SITE = "https://carp-ybb.com"


def log(msg: str) -> None:
    print(msg, flush=True)


def security_blocked(page) -> bool:
    if "sgcaptcha" in page.url:
        return True
    body = page.locator("body").inner_text().lower()
    return "connection security" in body or "requires cookies" in body


def clear_captcha(page, site: str) -> None:
    log(f"[sync-from-wp-playwright] open {site} (captcha check)...")
    page.goto(site, wait_until="domcontentloaded")
    for i in range(90):
        if not security_blocked(page):
            log("[sync-from-wp-playwright] captcha clear")
            return
        if i % 10 == 0:
            log(f"[sync-from-wp-playwright] waiting captcha... {i}s")
        page.wait_for_timeout(1000)
    raise RuntimeError("SiteGround captcha did not clear")


def obtain_cookie_header(site: str) -> str:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()
        clear_captcha(page, site)
        header = cookies_header(context.cookies())
        browser.close()
        return header


class CookieSession:
    def __init__(self, site: str) -> None:
        self.site = site
        self.header = obtain_cookie_header(site)

    def get(self) -> str:
        return self.header

    def refresh(self) -> str:
        log("[sync-from-wp-playwright] refreshing cookies via Playwright...")
        self.header = obtain_cookie_header(self.site)
        return self.header


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--site", default=SITE)
    parser.add_argument("--fetch-variations", action="store_true")
    parser.add_argument("--cache", default=str(DEFAULT_CACHE))
    parser.add_argument("--skip-sync", action="store_true")
    parser.add_argument("--workers", type=int, default=10, help="concurrent curl workers for variable details")
    args = parser.parse_args()

    site = args.site.rstrip("/")
    cache_path = Path(args.cache)
    cache_path.parent.mkdir(parents=True, exist_ok=True)

    log(
        f"[sync-from-wp-playwright] start site={site} "
        f"fetch_variations={args.fetch_variations} workers={args.workers}"
    )
    t0 = time.perf_counter()

    session = CookieSession(site)
    cookie_provider = session.get

    log("[sync-from-wp-playwright] curl list pages...")
    parents = fetch_product_pages(site, cookie_provider)
    log(f"[sync-from-wp-playwright] listed {len(parents)} parent products")

    products = parents
    if args.fetch_variations:
        variable_ids = [
            int(row["id"])
            for row in parents
            if row.get("type") == "variable" and row.get("id")
        ]
        log(
            f"[sync-from-wp-playwright] curl concurrent detail fetch "
            f"n={len(variable_ids)} workers={args.workers}"
        )

        def on_progress(done: int, total: int, pid: int) -> None:
            if done == 1 or done % 25 == 0 or done == total:
                log(f"[sync-from-wp-playwright] variable detail {done}/{total} id={pid}")

        try:
            details = fetch_variable_details(
                site,
                cookie_provider,
                variable_ids,
                workers=args.workers,
                on_progress=on_progress,
            )
        except PermissionError:
            session.refresh()
            details = fetch_variable_details(
                site,
                session.get,
                variable_ids,
                workers=args.workers,
                on_progress=on_progress,
            )

        products = []
        for row in parents:
            pid = int(row.get("id") or 0)
            products.append(details.get(pid, row))

    elapsed = time.perf_counter() - t0
    payload = {
        "site": site,
        "fetchedAt": datetime.now(timezone.utc).isoformat(),
        "productCount": len(products),
        "fetchMode": "playwright-cookies+curl",
        "workers": args.workers if args.fetch_variations else 1,
        "products": products,
    }
    cache_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    log(
        f"[sync-from-wp-playwright] cached {len(products)} products -> {cache_path} "
        f"({elapsed:.1f}s)"
    )

    if args.skip_sync:
        return 0

    cmd = ["node", "scripts/sync-from-wp.mjs", "--site", site, "--woo-cache", str(cache_path)]
    if args.fetch_variations:
        cmd.append("--fetch-variations")
    log("[sync-from-wp-playwright] running " + " ".join(cmd))
    result = subprocess.run(cmd, cwd=ROOT)
    return result.returncode


if __name__ == "__main__":
    raise SystemExit(main())
