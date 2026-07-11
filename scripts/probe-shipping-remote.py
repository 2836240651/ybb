#!/usr/bin/env python3
"""Probe live Woo shipping from deploy machine (avoids local SiteGround captcha)."""
from __future__ import annotations

import base64
import json
import subprocess
import sys
from pathlib import Path

REMOTE_PY = r'''
import json
import re
import urllib.request

SITE = "https://carp-ybb.com"

def fetch(url):
    req = urllib.request.Request(url, headers={"Accept": "application/json", "User-Agent": "ybb-shipping-probe/1.0"})
    with urllib.request.urlopen(req, timeout=60) as resp:
        return resp.read().decode("utf-8", "replace")

out = {"site": SITE}

# Product probe
product_raw = fetch(SITE + "/index.php?rest_route=/wc/store/v1/products/50709")
product = json.loads(product_raw)
out["product50709"] = {
    "name": product.get("name"),
    "prices": product.get("prices"),
    "needs_shipping": product.get("needs_shipping"),
    "is_virtual": product.get("is_virtual"),
}

# Add low-qty item via query string then read cart HTML
cart_add = fetch(SITE + "/cart/?add-to-cart=50709&quantity=1")
out["cartAddHasItem"] = "cart_item" in cart_add and "cart-empty" not in cart_add

def parse_cart(html, key):
    sub = re.search(r'cart-subtotal[\s\S]{0,400}', html, re.I)
    ship_block = re.search(r'woocommerce-shipping-totals shipping[\s\S]{0,1200}', html, re.I)
    total = re.search(r'order-total[\s\S]{0,400}', html, re.I)
    methods = re.findall(r'<input[^>]*name="shipping_method\[[^\]]*\]"[^>]*>', html, re.I)
    method_labels = re.findall(r'<label[^>]*for="shipping_method[^"]*"[^>]*>[\s\S]*?</label>', html, re.I)
    out[key] = {
        "subtotal": sub.group(0).replace("\n", " ")[:240] if sub else None,
        "shippingBlock": ship_block.group(0).replace("\n", " ")[:500] if ship_block else None,
        "shippingMethods": [m.replace("\n", " ") for m in methods],
        "shippingLabels": [re.sub(r"<[^>]+>", " ", m).strip() for m in method_labels],
        "total": total.group(0).replace("\n", " ")[:240] if total else None,
    }

parse_cart(cart_add, "cartLow")

# High quantity cart
cart_high = fetch(SITE + "/cart/?add-to-cart=50709&quantity=40")
parse_cart(cart_high, "cartHigh")

# Checkout page with US address via GET won't work; fetch checkout HTML after high cart
checkout_html = fetch(SITE + "/checkout/")
out["checkoutHasShipping"] = "shipping_method" in checkout_html
out["checkoutSnippet"] = checkout_html[checkout_html.find("order_review"):checkout_html.find("order_review")+1500] if "order_review" in checkout_html else checkout_html[:800]

print(json.dumps(out, ensure_ascii=False, indent=2))
'''

payload = base64.b64encode(REMOTE_PY.encode()).decode()
cmd = f"echo {payload} | base64 -d > /tmp/probe-shipping.py && python3 /tmp/probe-shipping.py"
proc = subprocess.run(
    ["ssh", "hermes-modx", cmd],
    capture_output=True,
    text=True,
    encoding="utf-8",
    errors="replace",
)
out_path = Path(__file__).resolve().parents[1] / "reports" / "shipping-probe-remote.json"
out_path.parent.mkdir(parents=True, exist_ok=True)
out_path.write_text((proc.stdout or "") + (proc.stderr or ""), encoding="utf-8")
print(proc.stdout or proc.stderr or "(no output)")
sys.exit(proc.returncode)
