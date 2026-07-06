#!/usr/bin/env python3
"""Acceptance checks for PDP Description tabs (product-live content HTML)."""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path
from urllib.parse import urljoin

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
SITE = "https://carp-ybb.com"
HANDLE = "tz-hk-001"
REPORT = ROOT / "reports" / "product-content-tabs-acceptance.json"

BLOCK_TAG = re.compile(r"<(p|ul|ol|h[1-6]|hr|div|table|blockquote)\b", re.I)


def clear(page) -> None:
    page.goto(SITE, wait_until="domcontentloaded")
    for _ in range(90):
        if "sgcaptcha" not in page.url:
            return
        page.wait_for_timeout(1000)


def fetch_json(page, path: str):
    import time
    sep = "&" if "?" in path else "?"
    busted = f"{path}{sep}_={int(time.time())}"
    page.goto(urljoin(SITE, busted), wait_until="domcontentloaded")
    page.wait_for_timeout(1200)
    text = page.locator("body").inner_text().strip()
    if not text or text[0] not in "{[":
        raise ValueError(text[:200])
    return json.loads(text)


def has_block_html(html: str) -> bool:
    return bool(html.strip()) and bool(BLOCK_TAG.search(html))


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
            live = fetch_json(
                page,
                f"/index.php?rest_route=/ybb/v1/site-manager/product-live/{HANDLE}",
            )
            content = live.get("content") or {}
            desc = content.get("description") or {}
            html = desc.get("html") or {}
            en = str(html.get("en") or "")
            zh = str(html.get("zh") or "")
            ja = str(html.get("ja") or "")
            record(
                "product-live content.description",
                desc.get("visible") is True and en != "",
                f"visible={desc.get('visible')} en_len={len(en)}",
            )
            record(
                "description html.en has block tags",
                has_block_html(en),
                f"p={en.lower().count('<p')} h2={en.lower().count('<h2')} ul={en.lower().count('<ul')} li={en.lower().count('<li')}",
            )
            record(
                "description html.zh structured like en",
                has_block_html(zh)
                and zh.lower().count("<h2") >= 1
                and zh.lower().count("<ul") >= 1,
                f"p={zh.lower().count('<p')} h2={zh.lower().count('<h2')} ul={zh.lower().count('<ul')} li={zh.lower().count('<li')}",
            )
            record(
                "description html.ja structured like en",
                has_block_html(ja)
                and ja.lower().count("<h2") >= 1
                and ja.lower().count("<ul") >= 1,
                f"p={ja.lower().count('<p')} h2={ja.lower().count('<h2')} ul={ja.lower().count('<ul')} li={ja.lower().count('<li')}",
            )
        except Exception as exc:
            record("product-live content.description", False, str(exc))
            record("description html.en has block tags", False, "skipped")
            record("description html.zh has block tags", False, "skipped")
            record("description html.ja has block tags", False, "skipped")

        try:
            page.goto(urljoin(SITE, f"/products/{HANDLE}.html"), wait_until="domcontentloaded")
            page.wait_for_timeout(3000)
            has_tabs = page.locator("#product-reviews-tab").count() > 0
            record("PDP content tabs section", has_tabs, f"url={page.url}")
        except Exception as exc:
            record("PDP content tabs section", False, str(exc))

    REPORT.parent.mkdir(parents=True, exist_ok=True)
    REPORT.write_text(json.dumps({"handle": HANDLE, "results": results}, indent=2), encoding="utf-8")
    print(f"\nReport: {REPORT}")

    failed = [r for r in results if not r["ok"]]
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
