#!/usr/bin/env python3
"""Scan ybb-site-manager admin PHP for likely parse-breaking corruption."""
from __future__ import annotations

import re
from pathlib import Path

BASE = Path(__file__).resolve().parents[1] / "deploy/wp-content/mu-plugins/ybb-site-manager"


def odd_quotes(line: str) -> bool:
    n = 0
    i = 0
    while i < len(line):
        if line[i] == "\\":
            i += 2
            continue
        if line[i] == "'":
            n += 1
        i += 1
    return n % 2 == 1


def main() -> int:
    issues = 0
    for php in sorted(BASE.rglob("*.php")):
        for no, line in enumerate(php.read_text(encoding="utf-8").splitlines(), 1):
            if "\ufffd" in line and ("<?php" in line or "=>" in line or "??" in line):
                print(f"{php.relative_to(BASE)}:{no}: {line[:120]}")
                issues += 1
            elif odd_quotes(line) and ("<?php" in line or line.strip().startswith("$")):
                if "?>" in line:
                    continue
                print(f"{php.relative_to(BASE)}:{no}: ODD {line[:120]}")
                issues += 1
    print("issues", issues)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
