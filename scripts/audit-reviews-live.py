#!/usr/bin/env python3
"""Audit live reviews page + embed for tz-eldz-012."""
import re
import urllib.request

PRODUCT = "tz-eldz-012"
WC_ID = 50505
BASE = "https://carp-ybb.com"

def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": "ybb-reviews-audit/1.0"})
    with urllib.request.urlopen(req, timeout=60) as res:
        return res.status, dict(res.headers), res.read().decode("utf-8", errors="replace")

print("=== reviews page ===")
for path in [
    f"/products/{PRODUCT}/reviews",
    f"/products/{PRODUCT}/reviews.html",
]:
    status, headers, body = fetch(BASE + path)
    print(path, "status", status, "len", len(body), "ctype", headers.get("Content-Type"))
    iframe = re.search(r'<iframe[^>]+src="([^"]+)"', body)
    print("  iframe", iframe.group(1) if iframe else "NONE")
    print("  build", (re.search(r"<!--([^>]+)-->", body) or [None, "?"])[1])

print("\n=== embed endpoint ===")
for url in [
    f"{BASE}/wp-json/ybb/v1/product-reviews-embed/{WC_ID}",
    f"{BASE}/index.php?rest_route=/ybb/v1/product-reviews-embed/{WC_ID}",
]:
    status, headers, body = fetch(url)
    print(url)
    print("  status", status, "ctype", headers.get("Content-Type"))
    print("  x-frame-options", headers.get("X-Frame-Options"), headers.get("x-frame-options"))
    print("  commentform", "commentform" in body, "form action", re.search(r'action="([^"]+)"', body))
    print("  body starts", body[:60].replace("\n", " "))

print("\n=== reviews REST ===")
status, headers, body = fetch(f"{BASE}/index.php?rest_route=/ybb/v1/product-reviews/{WC_ID}")
print("status", status, body[:200])
