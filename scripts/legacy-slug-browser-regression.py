#!/usr/bin/env python3
"""Browser regression for legacy slug -> canonical handle (with captcha clearance + delays)."""

from __future__ import annotations

import json
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urljoin

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
PRODUCTS_JSON = ROOT / "lib" / "data" / "products.json"
REPORT = ROOT / "reports" / "legacy-slug-browser-regression.json"
SITE = "https://carp-ybb.com"


def legacy_pairs(products: list[dict]) -> list[tuple[str, str, str]]:
    pairs: list[tuple[str, str, str]] = []
    for p in products:
        handle = str(p.get("handle") or "")
        sku = str(p.get("sku") or "")
        m = re.search(r"/products/([^/]+)/?", str(p.get("permalink") or ""))
        legacy = m.group(1) if m else ""
        if legacy and handle and legacy != handle:
            pairs.append((legacy, handle, sku))
    return pairs


def clear_security(page, site: str) -> None:
    page.goto(site, wait_until="domcontentloaded")
    for _ in range(60):
        if "sgcaptcha" not in page.url:
            return
        time.sleep(1)
    raise RuntimeError("captcha did not clear")


def main() -> int:
    products = json.loads(PRODUCTS_JSON.read_text(encoding="utf-8"))
    pairs = legacy_pairs(products)
    rows: list[dict] = []

    with sync_playwright() as p:
        page = p.chromium.launch(headless=False, channel="chrome").new_page()
        clear_security(page, SITE)
        for idx, (legacy, handle, sku) in enumerate(pairs, start=1):
            url = urljoin(SITE, f"/products/{legacy}/")
            handle_re = re.compile(rf"/products/{re.escape(handle)}(\.html)?/?$", re.I)
            try:
                page.goto(url, wait_until="commit", timeout=60000)
                try:
                    page.wait_for_url(handle_re, timeout=15000)
                except Exception:
                    pass
                page.wait_for_load_state("domcontentloaded", timeout=15000)
                time.sleep(0.5)
                final = page.url
                ok = bool(handle_re.search(final))
                if "sgcaptcha" in final:
                    ok = False
                    issue = "captcha"
                elif not ok:
                    issue = f"final={final}"
                else:
                    issue = ""
                rows.append({"legacy": legacy, "handle": handle, "sku": sku, "finalUrl": final, "ok": ok, "issue": issue})
                print(f"[{'PASS' if ok else 'FAIL'}] {legacy} -> {final}", flush=True)
            except Exception as exc:
                rows.append({"legacy": legacy, "handle": handle, "sku": sku, "ok": False, "issue": str(exc)})
                print(f"[FAIL] {legacy}: {exc}", flush=True)
            if idx % 5 == 0:
                clear_security(page, SITE)
                time.sleep(1)

    passed = sum(1 for r in rows if r.get("ok"))
    report = {
        "checkedAt": datetime.now(timezone.utc).isoformat(),
        "total": len(rows),
        "passed": passed,
        "failed": len(rows) - passed,
        "rows": rows,
    }
    REPORT.parent.mkdir(parents=True, exist_ok=True)
    REPORT.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"\n[legacy-browser-regression] {passed}/{len(rows)} PASS report={REPORT}", flush=True)
    return 0 if passed == len(rows) else 1


if __name__ == "__main__":
    raise SystemExit(main())
