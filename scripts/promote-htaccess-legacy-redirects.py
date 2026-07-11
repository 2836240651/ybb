#!/usr/bin/env python3
"""Move Woo legacy slug redirects before clean-URL .html rules; add .html counterparts."""

from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTACCESS = ROOT / "deploy" / "htaccess.snippet"
PRODUCTS_JSON = ROOT / "lib" / "data" / "products.json"

LEGACY_START = "# --- Woo permalink legacy → canonical handle (auto-generated) ---"
LEGACY_END = "# --- End legacy permalink redirects ---"
INSERT_BEFORE = "RewriteRule ^products/reviews/"
EARLY_MARKER = "# --- Legacy Woo slug → handle (EARLY: before clean URL .html) ---"


def legacy_from_products() -> list[tuple[str, str]]:
    if not PRODUCTS_JSON.exists():
        return []
    products = json.loads(PRODUCTS_JSON.read_text(encoding="utf-8"))
    pairs: list[tuple[str, str]] = []
    for p in products:
        handle = str(p.get("handle") or "")
        permalink = str(p.get("permalink") or "")
        m = re.search(r"/products/([^/]+)/?", permalink)
        legacy = m.group(1) if m else ""
        if legacy and handle and legacy != handle:
            pairs.append((legacy, handle))
    return pairs


def parse_legacy_rules(text: str) -> list[tuple[str, str]]:
    start = text.find(LEGACY_START)
    end = text.find(LEGACY_END)
    if start < 0 or end < 0:
        raise SystemExit("legacy section not found")
    block = text[start:end]
    rules: list[tuple[str, str]] = []
    for line in block.splitlines():
        m = re.match(
            r'^RewriteRule \^products/(.+?)/?\?\$ /products/([^\s\[]+) \[R=301,L\]$',
            line.strip(),
        )
        if m:
            rules.append((m.group(1), m.group(2)))
    return rules


def merge_rules(*groups: list[tuple[str, str]]) -> list[tuple[str, str]]:
    out: list[tuple[str, str]] = []
    seen: set[tuple[str, str]] = set()
    for group in groups:
        for pair in group:
            if pair not in seen:
                seen.add(pair)
                out.append(pair)
    return out


def build_early_block(rules: list[tuple[str, str]]) -> str:
    lines = [EARLY_MARKER]
    seen: set[str] = set()
    for legacy, handle in rules:
        plain = f"RewriteRule ^products/{legacy}/?$ /products/{handle} [R=301,L]"
        html = f"RewriteRule ^products/{legacy}\\.html$ /products/{handle}.html [R=301,L]"
        for rule in (plain, html):
            if rule not in seen:
                seen.add(rule)
                lines.append(rule)
    lines.append("")
    return "\n".join(lines)


def main() -> None:
    text = HTACCESS.read_text(encoding="utf-8")
    rules = merge_rules(parse_legacy_rules(text), legacy_from_products())
    if not rules:
        raise SystemExit("no legacy rules parsed")

    early = build_early_block(rules)

    # Remove prior EARLY block if re-run
    if EARLY_MARKER in text:
        start = text.find(EARLY_MARKER)
        end = text.find(INSERT_BEFORE, start)
        if end < 0:
            raise SystemExit(f"EARLY block end anchor missing: {INSERT_BEFORE}")
        text = text[:start].rstrip() + "\n" + text[end:].lstrip()

    idx = text.find(INSERT_BEFORE)
    if idx < 0:
        raise SystemExit(f"insert anchor not found: {INSERT_BEFORE}")
    text = text[:idx] + early + text[idx:]

    HTACCESS.write_text(text, encoding="utf-8")
    print(f"[promote-htaccess] inserted {len(rules)} legacy pairs ({len(rules)*2} rules) before clean URL block")


if __name__ == "__main__":
    main()
