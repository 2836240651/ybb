#!/usr/bin/env python3
"""Fetch live OEM sub-pages and compare markers."""
import re
import urllib.request

URLS = {
    "private-label": "https://carp-ybb.com/pages/private-label",
    "custom-packaging": "https://carp-ybb.com/pages/custom-packaging",
    "moq-lead-time": "https://carp-ybb.com/moq-lead-time",
}

MARKERS = {
    "private-label": {
        "new": [
            "10,000+ ready carp fishing tackle molds",
            "exclusive brand logo",
            "cross-border sellers and offline fishing stores",
        ],
        "old": [
            "OEM & ODM Custom Service Overview",
            "OEM Custom Mold Manufacturing",
            "All-In-One Custom Advantages",
        ],
    },
    "custom-packaging": {
        "new": [
            "One-stop custom packaging solution",
            "FREE graphic design support",
            "boosting shelf recognition",
        ],
        "old": [
            "OEM & ODM Custom Service Overview",
            "OEM Custom Mold Manufacturing",
        ],
    },
    "moq-lead-time": {
        "new": [
            "Minimum 3,000pcs for sinkers/bait cages",
            "30�?0 days",
            "Peak Season Support",
        ],
        "old": [
            "OEM & ODM Custom Service Overview",
            "All-In-One Custom Advantages",
        ],
    },
}

HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; ybb-oem-check/1.0)"}


def fetch(url: str) -> str:
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=30) as resp:
        return resp.read().decode("utf-8", errors="replace")


def extract_article_text(html: str) -> str:
    m = re.search(
        r'<article[^>]*class="[^"]*oem-overview-page[^"]*"[^>]*>(.*?)</article>',
        html,
        re.S,
    )
    if not m:
        m = re.search(r"<main[^>]*>(.*?)</main>", html, re.S)
    body = m.group(1) if m else html
    body = re.sub(r"<script[^>]*>.*?</script>", "", body, flags=re.S)
    text = re.sub(r"<[^>]+>", "\n", body)
    return "\n".join(line.strip() for line in text.splitlines() if line.strip())


for name, url in URLS.items():
    html = fetch(url)
    print(f"=== {name} ({url}) status via fetch ===")
    print(f"size: {len(html)} bytes")
    chunks = sorted(set(re.findall(r"/_next/static/chunks/([a-f0-9]+\.js)", html)))
    print("chunks:", ", ".join(chunks))
    for label, needles in MARKERS[name].items():
        for needle in needles:
            hit = needle in html
            print(f"  [{label}] {needle!r}: {'YES' if hit else 'no'}")
    print("ARTICLE TEXT:")
    for line in extract_article_text(html).splitlines()[:12]:
        print(f"  {line[:120]}")
    print()
