#!/usr/bin/env python3
"""Acceptance checks for PDP Shop Pay installment banner (product-live shopPayInstallments)."""

from __future__ import annotations

import json
import re
import sys
import time
from pathlib import Path
from urllib.parse import urljoin

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
SITE = "https://carp-ybb.com"
HANDLE = "tz-qz-013"
REPORT = ROOT / "reports" / "product-shop-pay-installments-acceptance.json"


def clear(page) -> None:
    page.goto(SITE, wait_until="domcontentloaded")
    for _ in range(90):
        if "sgcaptcha" not in page.url:
            return
        page.wait_for_timeout(1000)


def fetch_json(page, path: str):
    sep = "&" if "?" in path else "?"
    busted = f"{path}{sep}_={int(time.time() * 1000)}"
    page.goto(urljoin(SITE, busted), wait_until="domcontentloaded")
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
        print(f"[{status}] {name}" + (f" — {detail}" if detail else ""))

    with sync_playwright() as p:
        page = p.chromium.launch(headless=True).new_page()
        clear(page)

        live = None
        try:
            live = fetch_json(
                page,
                f"/index.php?rest_route=/ybb/v1/site-manager/product-live/{HANDLE}",
            )
            spi = live.get("shopPayInstallments") or {}
            record(
                "product-live shopPayInstallments shape",
                isinstance(spi, dict)
                and "visible" in spi
                and "template" in spi
                and "installmentCount" in spi,
                f"visible={spi.get('visible')} count={spi.get('installmentCount')}",
            )
            resolved_en = str((spi.get("resolved") or {}).get("en") or "")
            record(
                "resolved.en contains amount",
                bool(re.search(r"\$0\.1[0-9]", resolved_en)) or bool(re.search(r"0\.1", resolved_en)),
                resolved_en[:120],
            )
        except Exception as exc:
            record("product-live shopPayInstallments shape", False, str(exc))
            record("resolved.en contains amount", False, "skipped")

        try:
            page.goto(urljoin(SITE, f"/products/{HANDLE}.html"), wait_until="domcontentloaded")
            page.wait_for_timeout(2500)
            banner = page.locator(".shop-pay-installments")
            if live and live.get("shopPayInstallments", {}).get("visible") is False:
                record("PDP installment banner DOM", banner.count() == 0, f"count={banner.count()}")
            else:
                record("PDP installment banner DOM", banner.count() >= 1, f"count={banner.count()}")
                if banner.count() >= 1:
                    text = banner.first.inner_text()
                    record(
                        "PDP banner mentions instalment or Shop Pay",
                        "instalment" in text.lower()
                        or "installment" in text.lower()
                        or "shop pay" in text.lower()
                        or "分期" in text,
                        text[:120],
                    )
        except Exception as exc:
            record("PDP installment banner DOM", False, str(exc))
            record("PDP banner mentions instalment or Shop Pay", False, "skipped")

    REPORT.parent.mkdir(parents=True, exist_ok=True)
    REPORT.write_text(json.dumps({"results": results}, indent=2), encoding="utf-8")
    failed = sum(1 for r in results if not r["ok"])
    print(f"\nReport: {REPORT}")
    print(f"Failed: {failed}/{len(results)}")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
