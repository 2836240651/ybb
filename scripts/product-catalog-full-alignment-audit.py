#!/usr/bin/env python3
"""
Full-catalog alignment: products.json vs Woo Store API cache (no PDP browser).

Fast gate for all parent + variation SKUs (~503 parents, ~1500+ variants).
Run before/after sync and after deploy; pair with product-pdp-woo-alignment-audit.py for UI smoke.

Usage:
  py scripts/product-catalog-full-alignment-audit.py
  py scripts/product-catalog-full-alignment-audit.py --woo-cache reports/woo-store-products-cache.json
  py scripts/product-catalog-full-alignment-audit.py --refresh-cache   # Playwright fetch first
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PRODUCTS_JSON = ROOT / "lib" / "data" / "products.json"
DEFAULT_CACHE = ROOT / "reports" / "woo-store-products-cache.json"
DEFAULT_REPORT = ROOT / "reports" / "product-catalog-full-alignment.json"

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


def slug_from_permalink(permalink: str) -> str:
    match = re.search(r"/products/([^/]+)/?", permalink or "")
    return match.group(1).strip() if match else ""


def woo_variation_rows(wc_parent: dict) -> list[dict]:
    parent_sku = str(wc_parent.get("sku") or "")
    rows: list[dict] = []
    for var in wc_parent.get("variations") or []:
        attrs = var.get("attributes") or []
        spec = " / ".join(
            str(a.get("value") or a.get("option") or "").strip()
            for a in attrs
            if a
        ).strip()
        if not spec:
            sku = str(var.get("sku") or "")
            spec = sku.replace(f"{parent_sku}-", "") if parent_sku else sku
        rows.append(
            {
                "wcId": int(var.get("id") or 0),
                "sku": str(var.get("sku") or ""),
                "spec": spec,
            }
        )
    if not rows and wc_parent.get("type") == "simple":
        rows.append(
            {
                "wcId": int(wc_parent.get("id") or 0),
                "sku": parent_sku,
                "spec": "default",
            }
        )
    return rows


def static_variation_rows(product: dict) -> list[dict]:
    variants = product.get("variants") or []
    if variants:
        return [
            {
                "wcId": int(v.get("wcId") or 0),
                "sku": str(v.get("sku") or ""),
                "spec": str(v.get("spec") or ""),
            }
            for v in variants
        ]
    return [
        {
            "wcId": int(product.get("wcId") or 0),
            "sku": str(product.get("sku") or ""),
            "spec": str(product.get("spec") or "default"),
        }
    ]


def compare_product(product: dict, wc_parent: dict | None, *, strict_legacy: bool = False) -> dict:
    handle = str(product.get("handle") or "")
    parent_sku = str(product.get("sku") or "")
    issues: list[str] = []

    if wc_parent is None:
        return {
            "handle": handle,
            "sku": parent_sku,
            "wcId": product.get("wcId"),
            "ok": False,
            "issues": ["missing_in_woo_cache"],
        }

    woo_id = int(wc_parent.get("id") or 0)
    local_id = int(product.get("wcId") or 0)
    woo_sku = str(wc_parent.get("sku") or "")

    if local_id and woo_id and local_id != woo_id:
        issues.append(f"wcId local={local_id} woo={woo_id}")
    if parent_sku and woo_sku and parent_sku != woo_sku:
        issues.append(f"parentSku local={parent_sku} woo={woo_sku}")

    static_vars = static_variation_rows(product)
    woo_vars = woo_variation_rows(wc_parent)

    static_skus = sorted(v["sku"] for v in static_vars if v["sku"])
    woo_skus = sorted(v["sku"] for v in woo_vars if v["sku"])
    static_specs = sorted(v["spec"].lower() for v in static_vars if v["spec"])
    woo_specs = sorted(v["spec"].lower() for v in woo_vars if v["spec"])
    static_wc_ids = sorted(v["wcId"] for v in static_vars if v["wcId"])
    woo_wc_ids = sorted(v["wcId"] for v in woo_vars if v["wcId"])

    if len(static_vars) != len(woo_vars):
        issues.append(f"variant_count local={len(static_vars)} woo={len(woo_vars)}")
    elif woo_skus and static_skus != woo_skus:
        issues.append(f"variant_skus local={static_skus} woo={woo_skus}")
    elif static_wc_ids and woo_wc_ids and static_wc_ids != woo_wc_ids:
        issues.append(f"variant_wcIds local={static_wc_ids} woo={woo_wc_ids}")
    elif static_specs != woo_specs:
        issues.append(f"variant_specs local={static_specs} woo={woo_specs}")

    if any(s in OMC_DEMO_SPECS for s in static_specs):
        issues.append("static_has_omc_demo_specs")

    permalink_slug = slug_from_permalink(str(product.get("permalink") or ""))
    if permalink_slug and permalink_slug != handle and strict_legacy:
        issues.append(f"legacy_permalink_slug={permalink_slug} (301 -> {handle})")

    return {
        "handle": handle,
        "sku": parent_sku,
        "wcId": local_id,
        "wooWcId": woo_id,
        "collection": product.get("collection"),
        "variantCountLocal": len(static_vars),
        "variantCountWoo": len(woo_vars),
        "staticSkus": static_skus,
        "wooSkus": woo_skus,
        "permalinkSlug": permalink_slug or None,
        "legacyPermalink": permalink_slug if permalink_slug and permalink_slug != handle else None,
        "ok": len(issues) == 0,
        "issues": issues,
    }


def load_woo_cache(path: Path) -> dict[str, dict]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    products = payload.get("products", payload)
    if not isinstance(products, list):
        raise ValueError("invalid woo cache shape")
    by_sku: dict[str, dict] = {}
    for row in products:
        if row.get("type") == "variation":
            continue
        sku = str(row.get("sku") or "").strip()
        if sku:
            by_sku[sku] = row
    return by_sku


def refresh_woo_cache() -> None:
    script = ROOT / "scripts" / "sync-from-wp-playwright.py"
    log("[catalog-alignment] refreshing woo cache via Playwright...")
    subprocess.run(
        [sys.executable, "-u", str(script), "--fetch-variations", "--skip-sync"],
        cwd=ROOT,
        check=True,
    )


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--woo-cache", default=str(DEFAULT_CACHE))
    parser.add_argument("--report", default=str(DEFAULT_REPORT))
    parser.add_argument("--refresh-cache", action="store_true")
    parser.add_argument("--strict-legacy", action="store_true")
    args = parser.parse_args()

    cache_path = Path(args.woo_cache)
    if args.refresh_cache:
        refresh_woo_cache()

    if not cache_path.exists():
        log(f"[catalog-alignment] missing cache: {cache_path}")
        log("  run: py scripts/sync-from-wp-playwright.py --fetch-variations --skip-sync")
        return 1

    products = json.loads(PRODUCTS_JSON.read_text(encoding="utf-8"))
    woo_by_sku = load_woo_cache(cache_path)

    rows: list[dict] = []
    woo_only_skus = set(woo_by_sku) - {str(p.get("sku") or "") for p in products}
    for product in sorted(products, key=lambda p: str(p.get("sku") or "")):
        sku = str(product.get("sku") or "")
        rows.append(
            compare_product(product, woo_by_sku.get(sku), strict_legacy=args.strict_legacy)
        )

    passed = sum(1 for r in rows if r["ok"])
    failed_rows = [r for r in rows if not r["ok"]]
    issue_counts = Counter(
        issue.split(" ", 1)[0] if " " in issue else issue
        for r in failed_rows
        for issue in r.get("issues") or []
    )

    legacy_count = sum(1 for r in rows if r.get("legacyPermalink"))
    hard_fail = failed_rows

    report = {
        "checkedAt": datetime.now(timezone.utc).isoformat(),
        "productsJsonCount": len(products),
        "wooCacheCount": len(woo_by_sku),
        "wooOnlySkus": sorted(woo_only_skus)[:50],
        "wooOnlyCount": len(woo_only_skus),
        "total": len(rows),
        "passed": passed,
        "failed": len(failed_rows),
        "hardFailed": len(hard_fail),
        "legacyPermalinkCount": legacy_count,
        "issueBreakdown": dict(issue_counts.most_common()),
        "failures": failed_rows[:100],
        "rows": rows,
    }

    out = Path(args.report)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    log(f"[catalog-alignment] {passed}/{len(rows)} aligned (SKU+variants vs Woo cache)")
    if woo_only_skus:
        log(f"[catalog-alignment] woo-only SKUs not in products.json: {len(woo_only_skus)}")
    if issue_counts:
        log(f"[catalog-alignment] issue breakdown: {dict(issue_counts.most_common(8))}")
    if hard_fail:
        for r in hard_fail[:10]:
            log(f"  FAIL {r['sku']} {r['handle']}: {'; '.join(r['issues'])}")
        if len(hard_fail) > 10:
            log(f"  ... +{len(hard_fail) - 10} more (see report)")
    log(f"[catalog-alignment] report={out}")

    return 0 if not hard_fail else 1


if __name__ == "__main__":
    raise SystemExit(main())
