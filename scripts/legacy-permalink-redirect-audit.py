#!/usr/bin/env python3
"""Legacy Woo permalink URLs must 301 to canonical handle PDP."""

from __future__ import annotations

import argparse
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urljoin

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
PRODUCTS_JSON = ROOT / "lib" / "data" / "products.json"
DEFAULT_REPORT = ROOT / "reports" / "legacy-permalink-redirect-audit.json"
SITE = "https://carp-ybb.com"


def log(msg: str) -> None:
    print(msg, flush=True)


def legacy_pairs(products: list[dict]) -> list[tuple[str, str, str]]:
    pairs: list[tuple[str, str, str]] = []
    for p in products:
        handle = str(p.get("handle") or "")
        sku = str(p.get("sku") or "")
        permalink = str(p.get("permalink") or "")
        m = re.search(r"/products/([^/]+)/?", permalink)
        slug = m.group(1) if m else ""
        if slug and slug != handle:
            pairs.append((slug, handle, sku))
    return pairs


def clear_security(page, site: str) -> None:
    page.goto(site, wait_until="domcontentloaded")
    for _ in range(60):
        if "sgcaptcha" not in page.url:
            return
        page.wait_for_timeout(1000)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--site", default=SITE)
    parser.add_argument("--sample", type=int, default=0, help="0 = all legacy slugs")
    parser.add_argument("--report", default=str(DEFAULT_REPORT))
    args = parser.parse_args()

    site = args.site.rstrip("/")
    products = json.loads(PRODUCTS_JSON.read_text(encoding="utf-8"))
    pairs = legacy_pairs(products)
    if args.sample > 0:
        pairs = pairs[: args.sample]

    log(f"[legacy-redirect-audit] checking {len(pairs)} legacy permalinks")

    rows: list[dict] = []
    with sync_playwright() as p:
        page = p.chromium.launch(headless=True).new_page()
        clear_security(page, site)
        for idx, (legacy, handle, sku) in enumerate(pairs, start=1):
            url = urljoin(site, f"/products/{legacy}/")
            try:
                resp = page.goto(url, wait_until="commit", timeout=60000)
                page.wait_for_timeout(1500)
                final = page.url
                expected_suffix = f"/products/{handle}"
                ok = expected_suffix in final.replace(".html", "")
                if "sgcaptcha" in final:
                    ok = False
                    issue = "captcha"
                elif not ok:
                    issue = f"final={final}"
                else:
                    issue = ""
                rows.append(
                    {
                        "legacy": legacy,
                        "handle": handle,
                        "sku": sku,
                        "status": resp.status if resp else None,
                        "finalUrl": final,
                        "ok": ok,
                        "issue": issue,
                    }
                )
                if idx % 50 == 0:
                    log(f"  ... {idx}/{len(pairs)}")
                    clear_security(page, site)
            except Exception as exc:
                rows.append(
                    {
                        "legacy": legacy,
                        "handle": handle,
                        "sku": sku,
                        "ok": False,
                        "issue": str(exc),
                    }
                )

    passed = sum(1 for r in rows if r.get("ok"))
    report = {
        "checkedAt": datetime.now(timezone.utc).isoformat(),
        "total": len(rows),
        "passed": passed,
        "failed": len(rows) - passed,
        "rows": rows,
    }
    out = Path(args.report)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    log(f"[legacy-redirect-audit] {passed}/{len(rows)} PASS report={out}")
    return 0 if passed == len(rows) else 1


if __name__ == "__main__":
    raise SystemExit(main())
