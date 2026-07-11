#!/usr/bin/env python3
import re
import urllib.request

UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}


def fetch(url):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read().decode("utf-8", "replace"), r.status


def head(url):
    req = urllib.request.Request(url, method="HEAD", headers=UA)
    with urllib.request.urlopen(req, timeout=20) as r:
        return r.status


print("=== Asset HEAD checks ===")
for u in [
    "https://carp-ybb.com/wp-content/uploads/2026/07/TZ-HK-001.jpeg",
    "https://carp-ybb.com/images/placeholder-product.jpg",
    "https://carp-ybb.com/scripts/gallery-single-thumb-hotfix.js",
]:
    try:
        print(head(u), u)
    except Exception as e:
        print("FAIL", u, e)

print("\n=== collections/all embedded data ===")
html, _ = fetch("https://carp-ybb.com/collections/all")
imgs = re.findall(r'"images":\["([^"]+)"\]', html)
print("embedded images:", len(imgs))
for u in imgs:
    print(" ", u)

print("\n=== SSR img tags (uploads/placeholder/_next) ===")
for m in re.finditer(r"<img[^>]+>", html):
    tag = m.group(0)
    if any(x in tag for x in ("uploads", "placeholder", "_next/image", "product-card")):
        print(" ", tag[:200])

print("\n=== ProductCard in HTML? ===")
print("product-card count:", html.count("product-card"))
print("ProductGrid count:", html.count("ProductGrid"))

print("\n=== Pretty URL vs .html PDP image refs ===")
for path in ["/products/tz-hk-001", "/products/tz-hk-001.html"]:
    h, _ = fetch("https://carp-ybb.com" + path)
    refs = sorted(set(re.findall(r"wp-content/uploads/2026/[^\"\\]+", h)))
    hotfix = "gallery-single-thumb-hotfix" in h
    print(path, "refs=", refs[:2], "hotfix=", hotfix)

print("\n=== Check _next/image in out build config ===")
# grep deployed chunk hint
if "_next/image" in html:
    print("collections page uses _next/image")
else:
    print("collections page: no _next/image in raw html")
