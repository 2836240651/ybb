#!/usr/bin/env python3
import json
import re
import sys
from urllib.parse import urljoin

from playwright.sync_api import sync_playwright

SITE = "https://carp-ybb.com"


def clear(page) -> None:
    page.goto(SITE, wait_until="domcontentloaded")
    for _ in range(90):
        if "sgcaptcha" not in page.url:
            return
        page.wait_for_timeout(1000)


def main() -> int:
    with sync_playwright() as p:
        page = p.chromium.launch(headless=True).new_page()
        clear(page)
        page.goto(urljoin(SITE, "/products/tz-xp-038.html"), wait_until="domcontentloaded")
        page.wait_for_timeout(2000)
        html = page.content()
        match = re.search(r'buildId":"([^"]+)"', html)
        print("buildId", match.group(1) if match else "not found")
        print("variant 2# in page", "TZ-XP-038-2#" in html or "2#" in html)
        print("old orange in page", "橙色" in html)

        cart = page.evaluate(
            """async (url) => {
              const r = await fetch(url, { credentials: 'include' });
              const text = await r.text();
              return {
                status: r.status,
                nonce: r.headers.get('nonce'),
                cart: r.headers.get('cart-token'),
              };
            }""",
            urljoin(SITE, "/index.php?rest_route=/wc/store/v1/cart"),
        )
        print("cart status", cart["status"])
        headers = {"Content-Type": "application/json"}
        if cart.get("nonce"):
            headers["Nonce"] = cart["nonce"]
        if cart.get("cart"):
            headers["Cart-Token"] = cart["cart"]

        add = page.evaluate(
            """async ({ url, headers, body }) => {
              const r = await fetch(url, {
                method: 'POST',
                credentials: 'include',
                headers,
                body: JSON.stringify(body),
              });
              return { status: r.status, text: await r.text() };
            }""",
            {
                "url": urljoin(SITE, "/index.php?rest_route=/wc/store/v1/cart/add-item"),
                "headers": headers,
                "body": {
                    "id": 50886,
                    "quantity": 1,
                    "variation": [{"attribute": "Specification", "value": "2#"}],
                },
            },
        )
        print("add-item status", add["status"])
        print("add-item body", add["text"][:400])
        return 0 if add["status"] == 200 else 1


if __name__ == "__main__":
    raise SystemExit(main())
