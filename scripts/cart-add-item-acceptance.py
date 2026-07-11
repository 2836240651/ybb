#!/usr/bin/env python3
"""Smoke test: Woo Store API add-item using a known purchasable variable SKU."""

from __future__ import annotations

import json
import sys
from pathlib import Path
from urllib.parse import urljoin

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
PRODUCTS_PATH = ROOT / "lib" / "data" / "products.json"
WOO_CACHE_PATH = ROOT / "reports" / "woo-store-products-cache.json"
SITE = "https://carp-ybb.com"
PREFERRED_HANDLES = ["tz-el-074", "tz-qz-025", "tz-eldz-012"]


def clear(page) -> None:
    page.goto(SITE, wait_until="domcontentloaded")
    for _ in range(90):
        if "sgcaptcha" not in page.url:
            return
        page.wait_for_timeout(1000)


def load_products() -> list[dict]:
    return json.loads(PRODUCTS_PATH.read_text(encoding="utf-8"))


def load_woo_cache_by_sku() -> dict[str, dict]:
    if not WOO_CACHE_PATH.exists():
        return {}
    payload = json.loads(WOO_CACHE_PATH.read_text(encoding="utf-8"))
    products = payload.get("products", payload) if isinstance(payload, dict) else payload
    if not isinstance(products, list):
        return {}
    return {str(p.get("sku") or ""): p for p in products if p.get("sku")}


def pick_product(products: list[dict]) -> dict | None:
    by_handle = {str(p.get("handle") or ""): p for p in products}
    for handle in PREFERRED_HANDLES:
        product = by_handle.get(handle)
        if product and product.get("wcId") and product.get("variants"):
            return product
    for product in products:
        if (
            product.get("productType") == "variable"
            and product.get("wcId")
            and product.get("available", True)
            and product.get("variants")
        ):
            return product
    return None


def variation_payload(product: dict, woo_parent: dict | None) -> dict | None:
    variants = product.get("variants") or []
    if not variants:
        return None

    variant = variants[0]
    attrs = list(variant.get("wcAttributes") or [])
    if not attrs and woo_parent:
        woo_vars = woo_parent.get("variations") or []
        if woo_vars:
            for attr in woo_vars[0].get("attributes") or []:
                name = str(attr.get("name") or attr.get("attribute") or "").strip()
                value = str(attr.get("value") or attr.get("option") or "").strip()
                if name and value:
                    attrs.append({"attribute": name, "value": value})

    if not attrs:
        return None

    return {
        "id": int(product["wcId"]),
        "quantity": 1,
        "variation": attrs,
    }


def main() -> int:
    products = load_products()
    product = pick_product(products)
    if not product:
        print("FAIL no variable product with wcId in products.json", file=sys.stderr)
        return 1

    handle = str(product.get("handle") or "")
    sku = str(product.get("sku") or "")
    woo_cache = load_woo_cache_by_sku()
    body = variation_payload(product, woo_cache.get(sku))
    if not body:
        print(f"FAIL could not build variation payload for {handle}", file=sys.stderr)
        return 1

    print(f"target handle={handle} wcId={body['id']} variation={body['variation']}")

    with sync_playwright() as p:
        page = p.chromium.launch(headless=True).new_page()
        clear(page)
        page.goto(urljoin(SITE, f"/products/{handle}.html"), wait_until="domcontentloaded")
        page.wait_for_timeout(1500)

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
        print("cart status", cart["status"])
        headers = {"Content-Type": "application/json"}
        if cart.get("nonce"):
            headers["Nonce"] = cart["nonce"]
        if cart.get("cart"):
            headers["Cart-Token"] = cart["cart"]

        add = page.evaluate(
            """async ({ headers, body }) => {
              const r = await fetch('/index.php?rest_route=/wc/store/v1/cart/add-item', {
                method: 'POST',
                credentials: 'include',
                headers,
                body: JSON.stringify(body),
              });
              return { status: r.status, text: await r.text() };
            }""",
            {"headers": headers, "body": body},
        )
        print("add-item status", add["status"])
        print("add-item body", add["text"][:400])
        return 0 if add["status"] in (200, 201) else 1


if __name__ == "__main__":
    raise SystemExit(main())
