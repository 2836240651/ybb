import re
import urllib.request

html = urllib.request.urlopen(
    urllib.request.Request(
        "https://carp-ybb.com/collections/all",
        headers={"User-Agent": "Mozilla/5.0"},
    ),
    timeout=30,
).read().decode("utf-8", "replace")

# escaped JSON
for pat in [r'/products/tz-hk-001/master\.webp', r'wp-content/uploads', r'placeholder-product']:
    print(pat, len(re.findall(pat, html)))

# unescaped img src in SSR markup
imgs = re.findall(r'src="(/products/[^"]+)"', html)
print("img src count", len(imgs), imgs[:6])

# buildId
m = re.search(r"<!--([^>]+)-->", html[:300])
print("buildId", m.group(1) if m else None)
