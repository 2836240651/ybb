#!/usr/bin/env python3
"""Align variable-product variants in products.json with live Woo Store API."""

from __future__ import annotations

import json
import sys
from pathlib import Path
from urllib.parse import quote, urljoin

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
PRODUCTS_PATH = ROOT / "lib" / "data" / "products.json"
ID_MAP_PATH = ROOT / "deploy" / "product-import" / "wc-id-map.json"
SITE = "https://carp-ybb.com"


def clear_captcha(page) -> None:
    page.goto(SITE, wait_until="domcontentloaded")
    for _ in range(90):
        if "sgcaptcha" not in page.url:
            return
        page.wait_for_timeout(1000)
    raise RuntimeError("SiteGround captcha did not clear")


def fetch_json(page, path: str, retries: int = 3):
    last_error: Exception | None = None
    for attempt in range(retries):
        try:
            page.goto(urljoin(SITE, path), wait_until="domcontentloaded")
            page.wait_for_timeout(1000 + attempt * 400)
            text = page.locator("body").inner_text().strip()
            if not text or text[0] not in "{[":
                raise ValueError(text[:160])
            return json.loads(text)
        except Exception as exc:  # noqa: BLE001
            last_error = exc
            if "sgcaptcha" in page.url:
                clear_captcha(page)
    raise last_error or RuntimeError(f"fetch failed: {path}")


def attrs_from_variation(variation: dict) -> list[dict[str, str]]:
    out: list[dict[str, str]] = []
    for attr in variation.get("attributes") or []:
        name = str(attr.get("name") or attr.get("attribute") or "").strip()
        value = str(attr.get("value") or attr.get("option") or "").strip()
        if name and value:
            out.append({"attribute": name, "value": value})
    return out


def fetch_parent_detail(page, parent_sku: str, parent_id: int | None) -> dict | None:
    try:
        rows = fetch_json(page, f"/wp-json/wc/store/v1/products?sku={quote(parent_sku)}")
        if rows:
            return rows[0]
    except Exception:
        pass
    if parent_id:
        try:
            return fetch_json(page, f"/wp-json/wc/store/v1/products/{parent_id}")
        except Exception:
            return None
    return None


def rebuild_variants(product: dict, woo_parent: dict) -> bool:
    woo_variations = woo_parent.get("variations") or []
    if not woo_variations:
        return False

    old_variants = product.get("variants") or []
    rebuilt: list[dict] = []
    for index, woo_var in enumerate(woo_variations):
        attrs = attrs_from_variation(woo_var)
        fallback = old_variants[index] if index < len(old_variants) else {}
        spec = (
            " / ".join(attr["value"] for attr in attrs)
            or str(fallback.get("spec") or "").strip()
            or f"Option {index + 1}"
        )
        sku = str(woo_var.get("sku") or "").strip()
        if not sku and spec and product.get("sku"):
            sku = f"{product['sku']}-{spec.replace(' ', '')}"
        if not sku:
            sku = str(fallback.get("sku") or f"{product.get('sku')}-{spec}")
        price = float(fallback.get("price") or product.get("price") or 0)
        variant = {
            "sku": sku,
            "spec": spec,
            "price": price,
            "available": True,
            "wcId": int(woo_var["id"]),
        }
        if attrs:
            variant["wcAttributes"] = attrs
        images = fallback.get("images")
        if images:
            variant["images"] = images
        rebuilt.append(variant)

    product["variants"] = rebuilt
    product["defaultVariantSku"] = rebuilt[0]["sku"]
    product["wcId"] = int(woo_parent["id"])
    product["productType"] = "variable"
    if "spec" in product:
        del product["spec"]
    return True


def main() -> int:
    only_handle = None
    if "--handle" in sys.argv:
        only_handle = sys.argv[sys.argv.index("--handle") + 1]

    products = json.loads(PRODUCTS_PATH.read_text(encoding="utf-8"))
    id_map = json.loads(ID_MAP_PATH.read_text(encoding="utf-8")) if ID_MAP_PATH.exists() else {
        "parents": {},
        "variations": {},
    }

    targets = [
        p
        for p in products
        if p.get("productType") == "variable"
        and p.get("wcId")
        and p.get("sku")
        and (not only_handle or p.get("handle") == only_handle)
        and any(not v.get("wcAttributes") for v in (p.get("variants") or []))
    ]

    if not targets:
        print("No variable products need variant alignment.")
        return 0

    print(f"Aligning {len(targets)} products with Woo Store API")

    updated_products = 0
    failed: list[str] = []

    with sync_playwright() as p:
        page = p.chromium.launch(headless=True).new_page()
        clear_captcha(page)

        for product in targets:
            handle = str(product.get("handle") or "")
            parent_sku = str(product.get("sku") or "")
            parent_id = int(product.get("wcId") or 0) or None
            try:
                woo_parent = fetch_parent_detail(page, parent_sku, parent_id)
                if not woo_parent:
                    failed.append(f"{handle}: Woo parent not found for {parent_sku}")
                    continue
                if not rebuild_variants(product, woo_parent):
                    failed.append(f"{handle}: Woo parent has no variations")
                    continue

                id_map.setdefault("parents", {})[parent_sku] = {
                    "id": int(woo_parent["id"]),
                    "sku": parent_sku,
                }
                for variant in product["variants"]:
                    id_map.setdefault("variations", {})[variant["sku"]] = {
                        "id": variant["wcId"],
                        "parentSku": parent_sku,
                    }

                updated_products += 1
                specs = [v["spec"] for v in product["variants"]]
                print(f"  {handle} ({parent_sku}) -> {specs}")
            except Exception as exc:  # noqa: BLE001
                failed.append(f"{handle}: {exc}")

    if updated_products:
        PRODUCTS_PATH.write_text(json.dumps(products, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        ID_MAP_PATH.write_text(json.dumps(id_map, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"Updated {updated_products} products in products.json")

    if failed:
        print(f"Failed ({len(failed)}):")
        for row in failed[:25]:
            print(f"  - {row}")

    return 0 if updated_products else 1


if __name__ == "__main__":
    raise SystemExit(main())
