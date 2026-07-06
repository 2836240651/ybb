#!/usr/bin/env python3
"""
Full variant SKU audit: products.json (frontend catalog) vs Woo Store API (each variation).

Compares EVERY parent + EVERY variation SKU/wcId �?not sampled.
Uses Playwright browser context to bypass SiteGround captcha on REST.

Usage:
  py scripts/product-variant-sku-full-audit.py
  py scripts/product-variant-sku-full-audit.py --also-live-api
  py scripts/product-variant-sku-full-audit.py --also-pdp --pdp-limit 50
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import quote, urljoin

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
PRODUCTS_JSON = ROOT / "lib" / "data" / "products.json"
DEFAULT_REPORT = ROOT / "reports" / "product-variant-sku-full-audit.json"
SITE = "https://carp-ybb.com"


def log(msg: str) -> None:
    print(msg, flush=True)


def security_blocked(page) -> bool:
    if "sgcaptcha" in page.url:
        return True
    body = page.locator("body").inner_text().lower()
    return "connection security" in body or "requires cookies" in body


def clear_security(page, site: str) -> None:
    page.goto(site, wait_until="domcontentloaded")
    for i in range(90):
        if not security_blocked(page):
            return
        if i and i % 15 == 0:
            log(f"[variant-sku-audit] waiting captcha... {i}s")
        page.wait_for_timeout(1000)
    raise RuntimeError("captcha did not clear")


def fetch_json_http(site: str, path: str, retries: int = 4) -> dict | list:
    base = urljoin(site.rstrip("/") + "/", path.lstrip("/"))
    sep = "&" if "?" in base else "?"
    last: Exception | None = None
    for attempt in range(retries):
        url = f"{base}{sep}nocache={int(time.time() * 1000)}_{attempt}"
        try:
            proc = subprocess.run(
                ["curl.exe", "-sS", url],
                capture_output=True,
                text=True,
                encoding="utf-8",
                errors="replace",
                timeout=90,
            )
            if proc.returncode != 0:
                raise RuntimeError(proc.stderr.strip() or f"curl exit {proc.returncode}")
            text = proc.stdout.strip()
            if not text or text[0] not in "{[":
                raise ValueError(text[:200])
            return json.loads(text)
        except Exception as exc:
            last = exc
            time.sleep(0.3 + attempt * 0.2)
    raise last or RuntimeError(f"fetch failed: {path}")


def fetch_json(page, site: str, path: str, retries: int = 4) -> dict | list:
    last: Exception | None = None
    for attempt in range(retries):
        try:
            page.goto(urljoin(site, path), wait_until="domcontentloaded")
            page.wait_for_timeout(400 + attempt * 200)
            text = page.locator("body").inner_text().strip()
            if not text or text[0] not in "{[":
                raise ValueError(text[:200])
            return json.loads(text)
        except Exception as exc:
            last = exc
            if security_blocked(page):
                clear_security(page, site)
    raise last or RuntimeError(f"fetch failed: {path}")


def catalog_variants(product: dict) -> list[dict]:
    rows: list[dict] = []
    parent_sku = str(product.get("sku") or "")
    handle = str(product.get("handle") or "")
    variants = product.get("variants") or []
    if variants:
        for v in variants:
            rows.append(
                {
                    "handle": handle,
                    "parentSku": parent_sku,
                    "level": "variation",
                    "sku": str(v.get("sku") or ""),
                    "wcId": int(v.get("wcId") or 0),
                    "spec": str(v.get("spec") or ""),
                }
            )
    else:
        rows.append(
            {
                "handle": handle,
                "parentSku": parent_sku,
                "level": "simple",
                "sku": parent_sku,
                "wcId": int(product.get("wcId") or 0),
                "spec": str(product.get("spec") or "default"),
            }
        )
    return rows


def compare_sku_sets(catalog_rows: list[dict], woo_rows: list[dict]) -> list[str]:
    issues: list[str] = []
    cat_skus = sorted(r["sku"] for r in catalog_rows if r["sku"])
    woo_skus = sorted(r["sku"] for r in woo_rows if r["sku"])
    cat_ids = sorted(r["wcId"] for r in catalog_rows if r["wcId"])
    woo_ids = sorted(r["wcId"] for r in woo_rows if r["wcId"])

    if cat_skus and woo_skus and cat_skus != woo_skus:
        issues.append(f"variant_sku catalog={cat_skus} woo={woo_skus}")
    elif cat_ids and woo_ids and cat_ids != woo_ids:
        issues.append(f"variant_wcId catalog={cat_ids} woo={woo_ids}")
    elif len(catalog_rows) != len(woo_rows):
        issues.append(f"variant_count catalog={len(catalog_rows)} woo={len(woo_rows)}")
    return issues


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--site", default=SITE)
    parser.add_argument("--report", default=str(DEFAULT_REPORT))
    parser.add_argument("--also-live-api", action="store_true")
    parser.add_argument("--also-pdp", action="store_true")
    parser.add_argument("--pdp-limit", type=int, default=0, help="0 = all variable parents")
    args = parser.parse_args()

    site = args.site.rstrip("/")
    products = json.loads(PRODUCTS_JSON.read_text(encoding="utf-8"))
    variable_parents = [p for p in products if (p.get("variants") or []) and len(p["variants"]) > 1]
    simple_parents = [p for p in products if not (p.get("variants") or []) or len(p.get("variants") or []) <= 1]

    log(
        f"[variant-sku-audit] parents={len(products)} "
        f"variable={len(variable_parents)} simple={len(simple_parents)}"
    )

    parent_rows: list[dict] = []
    variant_rows: list[dict] = []
    failures: list[dict] = []

    for idx, product in enumerate(products, start=1):
        handle = str(product.get("handle") or "")
        parent_sku = str(product.get("sku") or "")
        parent_wc_id = int(product.get("wcId") or 0)

        if idx == 1 or idx % 25 == 0:
            log(f"[variant-sku-audit] woo fetch {idx}/{len(products)} {parent_sku}")

        try:
            woo_parent = fetch_json_http(
                site, f"/index.php?rest_route=/wc/store/v1/products/{parent_wc_id}"
            )
        except Exception as exc:
            failures.append(
                {
                    "handle": handle,
                    "parentSku": parent_sku,
                    "scope": "parent",
                    "ok": False,
                    "issues": [str(exc)],
                }
            )
            continue

        woo_parent_sku = str(woo_parent.get("sku") or "")
        parent_ok = not parent_sku or not woo_parent_sku or parent_sku == woo_parent_sku
        parent_row = {
            "handle": handle,
            "parentSku": parent_sku,
            "wcId": parent_wc_id,
            "wooSku": woo_parent_sku,
            "ok": parent_ok,
        }
        parent_rows.append(parent_row)
        if not parent_ok:
            failures.append(
                {
                    "handle": handle,
                    "parentSku": parent_sku,
                    "scope": "parent",
                    "ok": False,
                    "issues": [f"parentSku catalog={parent_sku} woo={woo_parent_sku}"],
                }
            )

        cat_vars = catalog_variants(product)
        woo_vars: list[dict] = []
        for cv in cat_vars:
            vid = cv["wcId"]
            if not vid:
                continue
            try:
                detail = fetch_json_http(
                    site, f"/index.php?rest_route=/wc/store/v1/products/{vid}"
                )
                woo_vars.append(
                    {
                        "sku": str(detail.get("sku") or ""),
                        "wcId": int(detail.get("id") or vid),
                        "spec": cv.get("spec") or "",
                    }
                )
            except Exception as exc:
                failures.append(
                    {
                        "handle": handle,
                        "parentSku": parent_sku,
                        "scope": "variation",
                        "catalogSku": cv.get("sku"),
                        "wcId": vid,
                        "ok": False,
                        "issues": [str(exc)],
                    }
                )

        issues = compare_sku_sets(cat_vars, woo_vars)
        row = {
            "handle": handle,
            "parentSku": parent_sku,
            "catalogSkus": sorted(v["sku"] for v in cat_vars if v["sku"]),
            "wooSkus": sorted(v["sku"] for v in woo_vars if v["sku"]),
            "catalogWcIds": sorted(v["wcId"] for v in cat_vars if v["wcId"]),
            "wooWcIds": sorted(v["wcId"] for v in woo_vars if v["wcId"]),
            "ok": len(issues) == 0 and len(cat_vars) == len(woo_vars),
            "issues": issues,
        }
        variant_rows.append(row)
        if not row["ok"]:
            failures.append({**row, "scope": "variations"})

    if args.also_live_api:
        log("[variant-sku-audit] YBB live API pass (all handles)...")
        for idx, product in enumerate(products, start=1):
            handle = quote(str(product.get("handle") or ""))
            cat_skus = sorted(v["sku"] for v in catalog_variants(product) if v["sku"])
            try:
                live = fetch_json_http(
                    site,
                    f"/index.php?rest_route=/ybb/v1/site-manager/product-overrides/{handle}",
                )
                live_skus = sorted(
                    str(v.get("sku") or "") for v in (live.get("variants") or []) if v.get("sku")
                )
                if cat_skus != live_skus:
                    failures.append(
                        {
                            "handle": product.get("handle"),
                            "parentSku": product.get("sku"),
                            "scope": "live_api",
                            "ok": False,
                            "issues": [f"live_skus {live_skus} != catalog {cat_skus}"],
                        }
                    )
            except Exception as exc:
                failures.append(
                    {
                        "handle": product.get("handle"),
                        "scope": "live_api",
                        "ok": False,
                        "issues": [str(exc)],
                    }
                )

    if args.also_pdp:
        with sync_playwright() as p:
            page = p.chromium.launch(headless=True).new_page()
            clear_security(page, site)
            targets = variable_parents
            if args.pdp_limit > 0:
                targets = targets[: args.pdp_limit]
            log(f"[variant-sku-audit] PDP spec pass n={len(targets)}...")
            for idx, product in enumerate(targets, start=1):
                handle = str(product.get("handle") or "")
                cat_specs = sorted(v.get("spec", "").lower() for v in catalog_variants(product))
                url = urljoin(site, f"/products/{handle}/")
                try:
                    page.goto(url, wait_until="domcontentloaded", timeout=90000)
                    page.wait_for_timeout(2500)
                    pdp_specs = page.evaluate(
                        """() => Array.from(document.querySelectorAll('[role=radiogroup] button'))
                        .map(b => (b.textContent||'').trim().toLowerCase()).filter(Boolean)"""
                    )
                    pdp_specs = sorted(pdp_specs)
                    if pdp_specs and cat_specs and pdp_specs != cat_specs:
                        failures.append(
                            {
                                "handle": handle,
                                "parentSku": product.get("sku"),
                                "scope": "pdp_ui",
                                "ok": False,
                                "issues": [f"pdp_specs {pdp_specs} != catalog {cat_specs}"],
                            }
                        )
                except Exception as exc:
                    failures.append(
                        {"handle": handle, "scope": "pdp_ui", "ok": False, "issues": [str(exc)]}
                    )
                if idx % 20 == 0:
                    clear_security(page, site)

    parent_pass = sum(1 for r in parent_rows if r.get("ok"))
    variant_pass = sum(1 for r in variant_rows if r.get("ok"))
    total_var_skus = sum(len(r.get("catalogSkus") or []) for r in variant_rows)

    report = {
        "checkedAt": datetime.now(timezone.utc).isoformat(),
        "site": site,
        "parentCount": len(products),
        "variationSkuCount": total_var_skus,
        "parentSkuPass": parent_pass,
        "parentSkuFail": len(parent_rows) - parent_pass,
        "variationSetsPass": variant_pass,
        "variationSetsFail": len(variant_rows) - variant_pass,
        "failureCount": len(failures),
        "failures": failures[:200],
        "parentRows": parent_rows,
        "variationRows": variant_rows,
    }

    out = Path(args.report)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    log(
        f"[variant-sku-audit] parent SKU: {parent_pass}/{len(parent_rows)} PASS | "
        f"variation sets: {variant_pass}/{len(variant_rows)} PASS | "
        f"total variation SKUs checked: {total_var_skus}"
    )
    if failures:
        for f in failures[:15]:
            log(
                f"  FAIL [{f.get('scope')}] {f.get('parentSku') or f.get('handle')}: "
                + "; ".join(f.get("issues") or [])
            )
        if len(failures) > 15:
            log(f"  ... +{len(failures) - 15} more in report")
    log(f"[variant-sku-audit] report={out}")

    return 0 if not failures else 1


if __name__ == "__main__":
    raise SystemExit(main())
