#!/usr/bin/env python3
"""Verify htaccess.restore covers all clean URLs from out/."""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "out"
HTACCESS = ROOT / "deploy" / "htaccess.restore"
REQUIRED_PATTERNS = [
    r"RewriteRule \^blogs/\(\[\^/\.\]\+\)/\(\[\^/\.\]\+\)/\?\$ /blogs/\$1/\$2\.html \[R=301,L\]",
    r"RewriteRule \^blogs/\(\[\^/\.\]\+\)/\?\$ /blogs/\$1\.html \[R=301,L\]",
    r"RewriteRule \^pages/\(\[\^/\.\]\+\)/\?\$ /pages/\$1\.html \[R=301,L\]",
    r"RewriteRule \^collections/\(\[\^/\.\]\+\)/\?\$ /collections/\$1\.html \[R=301,L\]",
    r"RewriteRule \^products/\(\[\^/\.\]\+\)/\?\$ /products/\$1\.html \[R=301,L\]",
    r"RewriteRule \^products/reviews/\(\[\^/\.\]\+\)/\?\$ /products/reviews/\$1\.html \[R=301,L\]",
    r"RewriteRule \^cart\(/\.\*\)\?\$ /index\.php",
    r"RewriteRule \^checkout\(/\.\*\)\?\$ /index\.php",
    r"DirectorySlash Off",
    r"RewriteRule \^ index\.html \[L\]",
]


def clean_urls_from_out() -> list[str]:
    urls: set[str] = {"/"}
    for html in OUT.rglob("*.html"):
        rel = html.relative_to(OUT).as_posix()
        if rel == "index.html":
            continue
        urls.add("/" + rel.removesuffix(".html"))
    return sorted(urls)


def expected_handler(path: str, ht: str) -> str:
    if path == "/":
        return "index.html"
    if re.match(r"^/collections/[^/]+$", path):
        return "collections/*.html rewrite"
    if re.match(r"^/products/[^/]+$", path) and not path.startswith("/products/reviews/"):
        return "products/*.html rewrite"
    if re.match(r"^/products/reviews/[^/]+$", path):
        return "products/reviews/*.html rewrite"
    if re.match(r"^/blogs/[^/]+/[^/]+$", path):
        return "blogs/*/*.html rewrite"
    if re.match(r"^/blogs/[^/]+$", path):
        return "blogs/*.html rewrite"
    if re.match(r"^/pages/[^/]+$", path):
        return "pages/*.html rewrite"
    if path in ("/cart", "/checkout", "/my-account", "/my-account-2") or path.startswith("/cart/"):
        return "woocommerce index.php"
    if path == "/wp-json" or path.startswith("/wp-json/"):
        return "wp-json index.php"
    return "generic .html fallback"


def main() -> int:
    if not HTACCESS.exists():
        print(f"FAIL missing {HTACCESS}", file=sys.stderr)
        return 1

    ht = HTACCESS.read_text(encoding="utf-8", errors="ignore")
    missing = [p for p in REQUIRED_PATTERNS if not re.search(p, ht)]
    if missing:
        print("FAIL htaccess.restore missing required rules:")
        for p in missing:
            print(f"  - {p}")
        return 1

    if len(ht) < 10000:
        print(f"FAIL htaccess.restore too small ({len(ht)} bytes) — likely WP-only stub", file=sys.stderr)
        return 1

    paths = clean_urls_from_out()
    rows = [{"path": p, "handler": expected_handler(p, ht)} for p in paths]
    by_handler: dict[str, int] = {}
    for r in rows:
        by_handler[r["handler"]] = by_handler.get(r["handler"], 0) + 1

    print(f"[validate] htaccess.restore OK ({len(ht)} bytes)")
    print(f"[validate] {len(paths)} clean URLs mapped:")
    for k, v in sorted(by_handler.items()):
        print(f"  {k}: {v}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
