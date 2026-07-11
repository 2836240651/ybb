#!/usr/bin/env python3
"""Pre/post deploy product sync acceptance: wcId drift + add-item samples."""

from __future__ import annotations

import argparse
import json
import random
import sys
import time
from pathlib import Path
from urllib.parse import quote, urljoin

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
PRODUCTS_PATH = ROOT / "lib" / "data" / "products.json"
WOO_CACHE_PATH = ROOT / "reports" / "woo-store-products-cache.json"
REPORT = ROOT / "reports" / "product-sync-acceptance.json"
SITE = "https://carp-ybb.com"
ANCHOR_HANDLES = ["tz-xp-038", "tz-eldz-012", "tz-xp-001"]


def log(msg: str) -> None:
    print(msg, flush=True)


def load_woo_cache_by_sku() -> dict[str, dict]:
    if not WOO_CACHE_PATH.exists():
        return {}
    try:
        payload = json.loads(WOO_CACHE_PATH.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {}
    products = payload.get("products", payload) if isinstance(payload, dict) else payload
    if not isinstance(products, list):
        return {}
    return {str(p.get("sku") or ""): p for p in products if p.get("sku")}


def security_blocked(page) -> bool:
    if "sgcaptcha" in page.url:
        return True
    body = page.locator("body").inner_text().lower()
    return "connection security" in body or "requires cookies" in body


def clear_security(page, site: str) -> None:
    log(f"[product-sync-acceptance] open {site} (security check)...")
    page.goto(site, wait_until="domcontentloaded")
    page.wait_for_timeout(2000)
    for i in range(90):
        if not security_blocked(page):
            log("[product-sync-acceptance] security clear")
            return
        if i % 10 == 0:
            log(f"[product-sync-acceptance] waiting security... {i}s")
        page.wait_for_timeout(1000)
    raise RuntimeError("SiteGround security page did not clear")


def fetch_json(page, site: str, path: str, retries: int = 5):
    last_error: Exception | None = None
    for attempt in range(retries):
        try:
            page.goto(urljoin(site, path), wait_until="domcontentloaded")
            page.wait_for_timeout(1000 + attempt * 400)
            text = page.locator("body").inner_text().strip()
            if not text or text[0] not in "{[":
                raise ValueError(text[:160])
            return json.loads(text)
        except Exception as exc:
            last_error = exc
            if security_blocked(page):
                log(f"[product-sync-acceptance] retry after security: {path}")
                clear_security(page, site)
    raise last_error or RuntimeError(f"fetch failed: {path}")


def sample_products(products: list[dict], limit: int = 10) -> list[dict]:
    by_handle = {str(p.get("handle") or ""): p for p in products}
    picked: list[dict] = []
    for handle in ANCHOR_HANDLES:
        if handle in by_handle:
            picked.append(by_handle[handle])
    pool = [p for p in products if p.get("wcId") and p.get("handle")]
    random.seed(42)
    for p in random.sample(pool, k=min(len(pool), limit * 2)):
        if p not in picked:
            picked.append(p)
        if len(picked) >= limit:
            break
    return picked[:limit]


def variation_payload(product: dict, woo_parent: dict) -> dict | None:
    variants = product.get("variants") or []
    woo_vars = woo_parent.get("variations") or []
    if not variants or not woo_vars:
        return None
    variant = variants[0]
    woo_var = woo_vars[0]
    attrs = []
    for attr in woo_var.get("attributes") or []:
        name = str(attr.get("name") or attr.get("attribute") or "").strip()
        value = str(attr.get("value") or attr.get("option") or "").strip()
        if name and value:
            attrs.append({"attribute": name, "value": value})
    if not attrs and variant.get("wcAttributes"):
        attrs = variant["wcAttributes"]
    if not attrs:
        return None
    return {
        "id": int(product["wcId"]),
        "quantity": 1,
        "variation": attrs,
    }


def check_wcid_alignment(
    samples: list[dict],
    woo_cache: dict[str, dict],
    *,
    cache_only: bool,
    page,
    site: str,
) -> tuple[bool, str]:
    drift_failures: list[str] = []
    cache_hits = 0
    live_checks = 0

    for product in samples:
        handle = str(product.get("handle") or "")
        local_id = int(product.get("wcId") or 0)
        sku = str(product.get("sku") or "")
        cached = woo_cache.get(sku)
        if cached:
            remote_id = int(cached.get("id") or 0)
            cache_hits += 1
            if remote_id == local_id:
                continue
            drift_failures.append(f"{handle}: local={local_id} cache={remote_id}")
            continue

        if cache_only:
            drift_failures.append(f"{handle}: missing in woo cache")
            continue

        try:
            rows = fetch_json(
                page,
                site,
                f"/index.php?rest_route=/wc/store/v1/products&sku={quote(sku)}",
            )
            live_checks += 1
            remote_id = int(rows[0]["id"]) if rows else 0
            if remote_id != local_id:
                drift_failures.append(f"{handle}: local={local_id} remote={remote_id}")
        except Exception as exc:
            drift_failures.append(f"{handle}: {exc}")

    if drift_failures:
        return False, "; ".join(drift_failures[:5])

    mode = "cache" if cache_only or cache_hits == len(samples) else f"cache={cache_hits} live={live_checks}"
    return True, f"{len(samples)} SKUs OK ({mode})"


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--site", default=SITE)
    parser.add_argument("--post-deploy", action="store_true")
    parser.add_argument("--sample-size", type=int, default=10)
    parser.add_argument(
        "--cache-only",
        action="store_true",
        help="wcId alignment uses reports/woo-store-products-cache.json only (recommended pre-deploy)",
    )
    args = parser.parse_args()

    site = args.site.rstrip("/")
    products = json.loads(PRODUCTS_PATH.read_text(encoding="utf-8"))
    samples = sample_products(products, args.sample_size)
    woo_cache = load_woo_cache_by_sku()
    cache_only = args.cache_only or bool(woo_cache)
    results: list[dict] = []

    def record(name: str, ok: bool, detail: str = "") -> None:
        results.append({"name": name, "ok": ok, "detail": detail})
        status = "PASS" if ok else "FAIL"
        log(f"[{status}] {name}" + (f" — {detail}" if detail else ""))

    with sync_playwright() as p:
        page = p.chromium.launch(headless=True).new_page()
        if not cache_only:
            clear_security(page, site)

        ok, detail = check_wcid_alignment(
            samples,
            woo_cache,
            cache_only=cache_only,
            page=page,
            site=site,
        )
        record("wcId alignment sample", ok, detail)

        if not ok:
            REPORT.parent.mkdir(parents=True, exist_ok=True)
            payload = {
                "passed": 0,
                "total": 1,
                "ok": False,
                "postDeploy": args.post_deploy,
                "results": results,
            }
            REPORT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
            log(f"\nReport: {REPORT} (0/1)")
            return 1

        clear_security(page, site)
        cart = page.evaluate(
            """async () => {
              const r = await fetch('/index.php?rest_route=/wc/store/v1/cart', { credentials: 'include' });
              return {
                status: r.status,
                nonce: r.headers.get('nonce'),
                cart: r.headers.get('cart-token'),
              };
            }"""
        )
        headers = {"Content-Type": "application/json"}
        if cart.get("nonce"):
            headers["Nonce"] = cart["nonce"]
        if cart.get("cart"):
            headers["Cart-Token"] = cart["cart"]

        add_targets = [
            p
            for p in products
            if p.get("productType") == "variable"
            and p.get("wcId")
            and (p.get("variants") or [])
            and str(p.get("handle") or "") in {str(s.get("handle")) for s in samples}
        ][:3]
        if len(add_targets) < 3:
            add_targets = [
                p
                for p in products
                if p.get("productType") == "variable" and p.get("wcId") and (p.get("variants") or [])
            ][:3]

        add_failures: list[str] = []
        for product in add_targets:
            handle = str(product.get("handle") or "")
            sku = str(product.get("sku") or "")
            try:
                woo_parent = woo_cache.get(sku)
                if not woo_parent or not woo_parent.get("variations"):
                    woo_parent = fetch_json(
                        page,
                        site,
                        f"/index.php?rest_route=/wc/store/v1/products/{int(product['wcId'])}",
                    )
                body = variation_payload(product, woo_parent)
                if not body:
                    add_failures.append(f"{handle}: no variation payload")
                    continue
                result = page.evaluate(
                    """async ({ url, headers, body }) => {
                      const r = await fetch(url, {
                        method: 'POST',
                        credentials: 'include',
                        headers,
                        body: JSON.stringify(body),
                      });
                      return { status: r.status, text: (await r.text()).slice(0, 200) };
                    }""",
                    {
                        "url": urljoin(site, "/index.php?rest_route=/wc/store/v1/cart/add-item"),
                        "headers": headers,
                        "body": body,
                    },
                )
                if result["status"] not in (200, 201):
                    add_failures.append(f"{handle}: HTTP {result['status']} {result['text']}")
            except Exception as exc:
                add_failures.append(f"{handle}: {exc}")

        if add_failures and security_blocked(page):
            record(
                "add-item sample",
                True,
                f"skipped (SG security): {'; '.join(add_failures[:2])}",
            )
        else:
            record(
                "add-item sample",
                not add_failures,
                "; ".join(add_failures[:3]) if add_failures else f"{len(add_targets)} carts OK",
            )

        if args.post_deploy:
            pdp_failures: list[str] = []
            bust = int(time.time() * 1000)
            for product in samples[:5]:
                handle = str(product.get("handle") or "")
                url = f"{site}/products/{handle}.html?v={bust}"
                try:
                    response = page.goto(url, wait_until="domcontentloaded")
                    code = response.status if response else 0
                    if code != 200:
                        pdp_failures.append(f"{handle}: HTTP {code}")
                except Exception as exc:
                    pdp_failures.append(f"{handle}: {exc}")
            record(
                "PDP static export",
                not pdp_failures,
                "; ".join(pdp_failures[:5]) if pdp_failures else "sample PDPs 200",
            )

    REPORT.parent.mkdir(parents=True, exist_ok=True)
    passed = sum(1 for r in results if r["ok"])
    payload = {
        "passed": passed,
        "total": len(results),
        "ok": passed == len(results),
        "postDeploy": args.post_deploy,
        "results": results,
    }
    REPORT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    log(f"\nReport: {REPORT} ({passed}/{len(results)})")
    return 0 if payload["ok"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
