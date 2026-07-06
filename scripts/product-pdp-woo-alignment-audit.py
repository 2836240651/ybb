#!/usr/bin/env python3
"""Sample PDPs (2 per collection) and compare variant specs/SKUs with Woo Store API."""

from __future__ import annotations

import argparse
import json
import re
import sys
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urljoin

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
SITE = "https://carp-ybb.com"
PRODUCTS_JSON = ROOT / "lib" / "data" / "products.json"
DEFAULT_REPORT = ROOT / "reports" / "product-pdp-woo-alignment.json"

OMC_DEMO_SPECS = {
    "standard pack",
    "twin pack",
    "value 3-pack",
    "bulk refill",
    "pro angler set",
    "gift edition",
}


def log(msg: str) -> None:
    print(msg, flush=True)


def clear_captcha(page, site: str) -> None:
    page.goto(site, wait_until="domcontentloaded")
    for _ in range(90):
        if "sgcaptcha" not in page.url:
            return
        page.wait_for_timeout(1000)
    raise RuntimeError("SiteGround captcha did not clear")


def fetch_json(page, site: str, path: str) -> dict | list:
    page.goto(urljoin(site, path), wait_until="domcontentloaded")
    page.wait_for_timeout(900)
    text = page.locator("body").inner_text().strip()
    if not text or text[0] not in "{[":
        raise ValueError(text[:240])
    return json.loads(text)


def pick_samples(products: list[dict], per_collection: int) -> list[dict]:
    by_collection: dict[str, list[dict]] = defaultdict(list)
    for product in products:
        if not product.get("wcId"):
            continue
        by_collection[str(product.get("collection") or "unknown")].append(product)

    samples: list[dict] = []
    for collection, rows in sorted(by_collection.items()):
        rows = sorted(rows, key=lambda r: str(r.get("sku") or r.get("handle")))
        for row in rows[:per_collection]:
            samples.append({**row, "_sampleCollection": collection})
    return samples


def pdp_variants(page, site: str, handle: str) -> dict:
    url = urljoin(site, f"/products/{handle}/")
    page.goto(url, wait_until="domcontentloaded", timeout=90000)
    page.wait_for_timeout(3500)
    data = page.evaluate(
        """() => {
      const buttons = Array.from(document.querySelectorAll('[role=radiogroup] button,[role=radio]'))
        .map((b) => (b.textContent || '').trim())
        .filter(Boolean);
      const body = document.body.innerText || '';
      const skuMatch = body.match(/TZ-[A-Z0-9-]+/);
      return { buttons, skuMatch: skuMatch ? skuMatch[0] : null, title: document.title };
    }"""
    )
    return {"url": url, **data}


def woo_variants(page, site: str, wc_id: int) -> dict:
    parent = fetch_json(page, site, f"/index.php?rest_route=/wc/store/v1/products/{wc_id}")
    if not isinstance(parent, dict):
        raise ValueError("invalid parent payload")
    variations = []
    for ref in parent.get("variations") or []:
        vid = ref.get("id") if isinstance(ref, dict) else ref
        detail = fetch_json(page, site, f"/index.php?rest_route=/wc/store/v1/products/{vid}")
        if isinstance(detail, dict):
            variations.append(detail)
    return {"parent": parent, "variations": variations}


def normalize_spec(value: str) -> str:
    return re.sub(r"\s+", " ", value.strip().lower())


def compare_row(product: dict, pdp: dict, woo: dict) -> dict:
    handle = product["handle"]
    parent_sku = str(product.get("sku") or "")
    static_specs = [normalize_spec(v.get("spec", "")) for v in product.get("variants") or []]
    static_skus = [str(v.get("sku") or "") for v in product.get("variants") or []]

    pdp_buttons = [normalize_spec(x) for x in pdp.get("buttons") or []]
    woo_parent = woo["parent"]
    woo_parent_sku = str(woo_parent.get("sku") or "")
    woo_specs: list[str] = []
    woo_skus: list[str] = []
    for var in woo["variations"]:
        attrs = var.get("attributes") or []
        spec = " / ".join(
            str(a.get("value") or a.get("option") or "").strip() for a in attrs if a
        ).strip()
        if not spec:
            spec = str(var.get("sku") or "").replace(f"{woo_parent_sku}-", "")
        woo_specs.append(normalize_spec(spec))
        woo_skus.append(str(var.get("sku") or ""))

    issues: list[str] = []
    if woo_parent_sku and parent_sku and woo_parent_sku != parent_sku:
        issues.append(f"parentSku mismatch static={parent_sku} woo={woo_parent_sku}")
    if any(spec in OMC_DEMO_SPECS for spec in pdp_buttons):
        issues.append("pdp_has_omc_demo_specs")
    if woo_specs:
        if sorted(pdp_buttons) != sorted(woo_specs):
            issues.append(f"pdp_specs {pdp_buttons} != woo {woo_specs}")
        if sorted(static_specs) != sorted(woo_specs):
            issues.append(f"static_specs {static_specs} != woo {woo_specs}")
        if sorted(static_skus) != sorted(woo_skus):
            issues.append(f"static_skus {static_skus} != woo {woo_skus}")
    elif pdp_buttons and not woo_specs:
        issues.append(f"simple_or_missing_woo_variants pdp={pdp_buttons}")

    ok = len(issues) == 0
    return {
        "collection": product.get("_sampleCollection"),
        "handle": handle,
        "sku": parent_sku,
        "wcId": product.get("wcId"),
        "pdpUrl": pdp.get("url"),
        "pdpButtons": pdp.get("buttons"),
        "wooSpecs": woo_specs,
        "wooSkus": woo_skus,
        "staticSpecs": static_specs,
        "ok": ok,
        "issues": issues,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--per-collection", type=int, default=2)
    parser.add_argument("--report", default=str(DEFAULT_REPORT))
    parser.add_argument("--site", default=SITE)
    args = parser.parse_args()

    site = args.site.rstrip("/")

    products = json.loads(PRODUCTS_JSON.read_text(encoding="utf-8"))
    samples = pick_samples(products, args.per_collection)
    log(f"[pdp-woo-alignment] samples={len(samples)} per_collection={args.per_collection}")

    rows: list[dict] = []
    with sync_playwright() as p:
        page = p.chromium.launch(headless=True).new_page()
        clear_captcha(page, site)
        for idx, product in enumerate(samples, start=1):
            handle = product["handle"]
            wc_id = int(product.get("wcId") or 0)
            log(f"[{idx}/{len(samples)}] {product.get('_sampleCollection')} {handle} wcId={wc_id}")
            try:
                pdp = pdp_variants(page, site, handle)
                woo = woo_variants(page, site, wc_id)
                row = compare_row(product, pdp, woo)
            except Exception as exc:
                row = {
                    "collection": product.get("_sampleCollection"),
                    "handle": handle,
                    "sku": product.get("sku"),
                    "wcId": wc_id,
                    "ok": False,
                    "issues": [f"error: {exc}"],
                }
            status = "PASS" if row.get("ok") else "FAIL"
            log(f"  [{status}] {handle} " + ("; ".join(row.get("issues") or []) or "aligned"))
            rows.append(row)

    passed = sum(1 for r in rows if r.get("ok"))
    report = {
        "site": site,
        "checkedAt": datetime.now(timezone.utc).isoformat(),
        "perCollection": args.per_collection,
        "total": len(rows),
        "passed": passed,
        "failed": len(rows) - passed,
        "rows": rows,
    }
    out = Path(args.report)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    log(f"[pdp-woo-alignment] {passed}/{len(rows)} PASS report={out}")
    return 0 if passed == len(rows) else 1


if __name__ == "__main__":
    raise SystemExit(main())
