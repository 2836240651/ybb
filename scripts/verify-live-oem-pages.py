#!/usr/bin/env python3
"""Verify live OEM page article text (curl subprocess)."""
import re
import subprocess

URLS = {
    "private-label": "https://carp-ybb.com/pages/private-label",
    "custom-packaging": "https://carp-ybb.com/pages/custom-packaging",
    "moq-lead-time": "https://carp-ybb.com/moq-lead-time",
    "oem-odm-overview": "https://carp-ybb.com/pages/oem-odm",
}


def fetch(url: str) -> str:
    r = subprocess.run(
        ["curl.exe", "-sS", "-L", url],
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        check=True,
    )
    return r.stdout


def article_text(html: str) -> str:
    m = re.search(
        r'<article[^>]*class="[^"]*oem-overview-page[^"]*"[^>]*>(.*?)</article>',
        html,
        re.S,
    )
    if not m:
        return "(no article)"
    text = re.sub(r"<script[^>]*>.*?</script>", "", m.group(1), flags=re.S)
    text = re.sub(r"<[^>]+>", "\n", text)
    return "\n".join(line.strip() for line in text.splitlines() if line.strip())


for name, url in URLS.items():
    html = fetch(url)
    print(f"=== {name} ===")
    print(f"URL: {url}")
    print(f"HTTP size: {len(html)}")
    print(f"has overview title: {'OEM & ODM Custom Service Overview' in html}")
    print(f"has OemPageContent chunk: {'70a4440e4081281d.js' in html}")
    print("ARTICLE:")
    for line in article_text(html).splitlines():
        print(f"  {line[:120]}")
    print()
