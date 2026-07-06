#!/usr/bin/env python3
from playwright.sync_api import sync_playwright

URLS = [
    "https://carp-ybb.com/products/carp-accessory/",
    "https://carp-ybb.com/products/tz-zbsb-006/",
]


def main() -> None:
    with sync_playwright() as p:
        page = p.chromium.launch(headless=True).new_page()
        page.goto("https://carp-ybb.com", wait_until="domcontentloaded")
        page.wait_for_timeout(2000)
        for url in URLS:
            page.goto(url, wait_until="networkidle", timeout=90000)
            html = page.content()
            opts = page.evaluate(
                """() => Array.from(document.querySelectorAll('[role=radiogroup] button'))
                .map((b) => b.textContent.trim())"""
            )
            print("===", url)
            print("standard_pack_in_html", "Standard pack" in html)
            print("variant_buttons", opts)
            print("sku_in_body", "TZ-ZBSB-006" in page.inner_text("body"))


if __name__ == "__main__":
    main()
