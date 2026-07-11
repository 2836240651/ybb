#!/usr/bin/env python3
"""Find PHP lines with unbalanced single-quoted strings."""
from __future__ import annotations

from pathlib import Path

TARGET = Path(__file__).resolve().parents[1] / (
    "deploy/wp-content/mu-plugins/ybb-site-manager/includes/modules/audit-log.php"
)


def odd_single_quotes(line: str) -> bool:
    count = 0
    i = 0
    while i < len(line):
        ch = line[i]
        if ch == "\\":
            i += 2
            continue
        if ch == "'":
            count += 1
        i += 1
    return count % 2 == 1


def main() -> int:
    text = TARGET.read_text(encoding="utf-8")
    for no, line in enumerate(text.splitlines(), 1):
        stripped = line.strip()
        if not stripped or stripped.startswith("//") or stripped.startswith("*"):
            continue
        if odd_single_quotes(line):
            print(f"{no}: {line[:140]}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
