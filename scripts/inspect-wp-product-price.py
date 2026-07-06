#!/usr/bin/env python3
"""Inspect Woo product edit page price fields (diagnostic)."""
import json
import re
import sys
from pathlib import Path
from urllib.parse import urljoin

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
secrets = json.loads((ROOT / "secrets.local.json").read_text(encoding="utf-8"))
user = secrets["wordpress"]["email"]
pwd = secrets["wordpress"]["password"]
SITE = "https://carp-ybb.com"
post_id = int(sys.argv[1]) if len(sys.argv) > 1 else 51369
edit_url = f"{SITE}/wp-admin/post.php?post={post_id}&action=edit"


def log(msg: str) -> None:
    print(msg, flush=True)


def clear_captcha(page) -> None:
    page.goto(SITE, wait_until="domcontentloaded")
    for i in range(60):
        if "sgcaptcha" not in page.url:
            return
        page.wait_for_timeout(1000)
    raise RuntimeError("captcha did not clear")


def wp_login(page) -> None:
    page.goto(f"{SITE}/wp-login.php", wait_until="domcontentloaded")
    page.fill("#user_login", user)
    page.fill("#user_pass", pwd)
    cap_visible = page.locator('input[type="number"]')
    if cap_visible.count():
        label = page.locator("label").filter(has_text=re.compile(r"\d+\s*\+\s*\d+"))
        label_text = label.first.inner_text() if label.count() else ""
        m = re.search(r"(\d+)\s*\+\s*(\d+)", label_text)
        if m:
            cap_visible.first.fill(str(int(m.group(1)) + int(m.group(2))))
    page.click("#wp-submit")
    page.wait_for_timeout(3000)
    log(f"login_url={page.url}")


def fetch_store_json(page, path: str) -> dict | list | None:
    page.goto(urljoin(SITE, path), wait_until="domcontentloaded")
    page.wait_for_timeout(800)
    text = page.locator("body").inner_text().strip()
    if not text or text[0] not in "{[":
        return None
    return json.loads(text)


def inspect_dom(page) -> dict:
    return page.evaluate(
        """() => {
      const q = (s) => document.querySelector(s);
      const qa = (s) => Array.from(document.querySelectorAll(s));
      const field = (el) => el ? {
        visible: !!(el.offsetParent || el.getClientRects().length),
        disabled: !!el.disabled,
        readonly: !!el.readOnly,
        value: el.value ?? '',
        display: getComputedStyle(el).display,
      } : null;
      return {
        productType: q('#product-type')?.value ?? null,
        generalRegular: field(q('#_regular_price')),
        generalSale: field(q('#_sale_price')),
        generalPricingPanel: !!q('#general_product_data .pricing'),
        variablePricingHidden: q('#general_product_data .pricing')?.classList?.contains('hide_if_variable'),
        variationPriceInputs: qa('input[name^="variable_regular_price"]').map(field),
        variationTab: !!q('a[href="#variable_product_options"]'),
        sku: q('#_sku')?.value ?? null,
      };
    }"""
    )


def main() -> int:
    with sync_playwright() as p:
        page = p.chromium.launch(headless=True).new_page()
        ajax_log: list[str] = []

        def on_response(resp) -> None:
            url = resp.url
            if "admin-ajax.php" in url or "async-upload" in url:
                try:
                    body = resp.text()[:300]
                except Exception:
                    body = "<unreadable>"
                ajax_log.append(f"{resp.status} {resp.request.method} {url} :: {body}")

        page.on("response", on_response)
        clear_captcha(page)
        wp_login(page)

        log(f"open {edit_url}")
        page.goto(edit_url, wait_until="domcontentloaded", timeout=120000)
        for i in range(45):
            if page.locator("#product-type").count():
                break
            page.wait_for_timeout(1000)
        log(f"product_url={page.url}")

        dom = inspect_dom(page)
        log("dom_inspect=" + json.dumps(dom, ensure_ascii=False))
        rows = page.evaluate(
            """() => {
              const typeSel = document.querySelector('#product-type');
              const tabs = Array.from(document.querySelectorAll('.product_data_tabs li')).map((li) => ({
                id: li.className,
                text: (li.textContent || '').trim(),
                hidden: getComputedStyle(li).display === 'none',
              }));
              return {
                variationRows: document.querySelectorAll('#variable_product_options .woocommerce_variation').length,
                expandAll: !!document.querySelector('.expand_all'),
                loadVariations: !!document.querySelector('.variations_actions .do_variation_action'),
                productTypeValue: typeSel?.value ?? null,
                productTypeText: typeSel?.selectedOptions?.[0]?.text ?? null,
                tabs,
              };
            }"""
        )
        log("variation_ui=" + json.dumps(rows))

        if page.locator('a[href="#variable_product_options"]').count():
            page.locator('a[href="#variable_product_options"]').first.click()
            page.wait_for_timeout(6000)
            rows_after = page.evaluate(
                """() => ({
                  variationRows: document.querySelectorAll('#variable_product_options .woocommerce_variation').length,
                  expandAll: !!document.querySelector('.expand_all'),
                })"""
            )
            log("after_var_tab=" + json.dumps(rows_after))
            if rows_after.get("variationRows", 0) == 0:
                page.wait_for_timeout(8000)
                rows2 = page.evaluate(
                    "document.querySelectorAll('#variable_product_options .woocommerce_variation').length"
                )
                log(f"variation_rows_after_wait={rows2}")
            if page.locator(".expand_all").count():
                try:
                    page.locator(".expand_all").first.click(timeout=3000)
                    page.wait_for_timeout(2000)
                except Exception:
                    page.evaluate(
                        """() => {
                      document.querySelectorAll('#variable_product_options .woocommerce_variation h3').forEach((h) => h.click());
                    }"""
                    )
                    page.wait_for_timeout(2000)
            dom2 = inspect_dom(page)
            log(
                "variation_price_inputs="
                + json.dumps(dom2.get("variationPriceInputs"), ensure_ascii=False)
            )

        for line in ajax_log[-15:]:
            log("ajax " + line.replace("\n", " ")[:500])

        api = fetch_store_json(page, f"/index.php?rest_route=/wc/store/v1/products/{post_id}")
        if isinstance(api, dict):
            log(
                "store_api="
                + json.dumps(
                    {
                        "type": api.get("type"),
                        "sku": api.get("sku"),
                        "price": (api.get("prices") or {}).get("price"),
                        "variations": api.get("variations"),
                    },
                    ensure_ascii=False,
                )
            )
            for var_ref in (api.get("variations") or [])[:6]:
                vid = var_ref.get("id") if isinstance(var_ref, dict) else var_ref
                vd = fetch_store_json(page, f"/index.php?rest_route=/wc/store/v1/products/{vid}")
                if isinstance(vd, dict):
                    log(
                        f"variation id={vid} sku={vd.get('sku')} price={(vd.get('prices') or {}).get('price')}"
                    )

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
