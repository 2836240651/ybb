#!/usr/bin/env python3
"""Acceptance checks for Product Ops Layer REST + live merge."""

from __future__ import annotations

import json
import sys
from pathlib import Path
from urllib.parse import urljoin

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
SITE = "https://carp-ybb.com"
REPORT = ROOT / "reports" / "product-ops-acceptance.json"


def clear(page) -> None:
    page.goto(SITE, wait_until="domcontentloaded")
    for _ in range(90):
        if "sgcaptcha" not in page.url:
            return
        page.wait_for_timeout(1000)


def fetch_json(page, path: str):
    page.goto(urljoin(SITE, path), wait_until="domcontentloaded")
    page.wait_for_timeout(1200)
    text = page.locator("body").inner_text().strip()
    if not text or text[0] not in "{[":
        raise ValueError(text[:200])
    return json.loads(text)


def main() -> int:
    results: list[dict] = []

    def record(name: str, ok: bool, detail: str = "") -> None:
        results.append({"name": name, "ok": ok, "detail": detail})
        status = "PASS" if ok else "FAIL"
        print(f"[{status}] {name}" + (f" �?{detail}" if detail else ""))

    with sync_playwright() as p:
        page = p.chromium.launch(headless=True).new_page()
        clear(page)

        try:
            overrides = fetch_json(
                page,
                "/index.php?rest_route=/ybb/v1/site-manager/product-overrides",
            )
            record(
                "product-overrides REST",
                isinstance(overrides.get("overrides"), dict),
                f"enabled={overrides.get('enabled')} keys={len(overrides.get('overrides') or {})}",
            )
        except Exception as exc:
            record("product-overrides REST", False, str(exc))

        try:
            live = fetch_json(
                page,
                "/index.php?rest_route=/ybb/v1/site-manager/product-live/tz-xp-038",
            )
            has_variants = len(live.get("variants") or []) > 0
            wc_id = int(live.get("wcId") or 0)
            images = live.get("images") or []
            record(
                "product-live tz-xp-038",
                wc_id > 0 and has_variants and isinstance(images, list),
                f"wcId={wc_id} variants={len(live.get('variants') or [])} images={len(images)}",
            )
        except Exception as exc:
            record("product-live tz-xp-038", False, str(exc))

        try:
            page.goto(urljoin(SITE, "/products/tz-xp-038.html"), wait_until="domcontentloaded")
            page.wait_for_timeout(2500)
            has_live_fetch = page.evaluate(
                """async () => {
                  const url = '/index.php?rest_route=/ybb/v1/site-manager/product-live/tz-xp-038&_=' + Date.now();
                  const r = await fetch(url, { credentials: 'include' });
                  return r.ok;
                }"""
            )
            record("PDP client fetch live", bool(has_live_fetch))
        except Exception as exc:
            record("PDP client fetch live", False, str(exc))

        try:
            page.goto(urljoin(SITE, "/collections/2026-new-products.html"), wait_until="domcontentloaded")
            page.wait_for_timeout(2500)
            has_store_fetch = page.evaluate(
                """async () => {
                  const r = await fetch('/index.php?rest_route=/wc/store/v1/products/50886', { credentials: 'include' });
                  return r.ok;
                }"""
            )
            record("collection store fetch", bool(has_store_fetch))
        except Exception as exc:
            record("collection store fetch", False, str(exc))

    REPORT.parent.mkdir(parents=True, exist_ok=True)
    passed = sum(1 for r in results if r["ok"])
    payload = {
        "passed": passed,
        "total": len(results),
        "ok": passed == len(results),
        "results": results,
    }
    REPORT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"\nReport: {REPORT} ({passed}/{len(results)})")
    return 0 if payload["ok"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
