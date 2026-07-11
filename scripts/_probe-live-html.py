#!/usr/bin/env python3
import re
import urllib.request

url = "https://carp-ybb.com/collections/all"
html = urllib.request.urlopen(
    urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"}),
    timeout=30,
).read().decode("utf-8", "replace")
m = re.search(r"<!--([^>]+)-->", html[:300])
print("buildId", m.group(1) if m else None)
for pat in ["master.webp", "wp-content/uploads", "placeholder-product"]:
    print(pat, html.count(pat))
imgs = re.findall(r'src="([^"]*(?:master\.webp|wp-content/uploads)[^"]*)"', html)
print("sample", imgs[:6])
