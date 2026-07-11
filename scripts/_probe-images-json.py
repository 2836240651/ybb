import re
import urllib.request

html = urllib.request.urlopen(
    urllib.request.Request(
        "https://carp-ybb.com/collections/all",
        headers={"User-Agent": "Mozilla/5.0"},
    ),
    timeout=30,
).read().decode("utf-8", "replace")

for handle in ["tz-hk-001", "tz-zj-002", "tz-eldz-013"]:
    m = re.search(rf'"handle":"{handle}".*?"images":\[(.*?)\]', html)
    print(handle, m.group(1)[:160] if m else "NO MATCH")
