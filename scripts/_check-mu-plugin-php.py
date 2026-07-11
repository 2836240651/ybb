#!/usr/bin/env python3
"""Quick PHP parse sanity check (unclosed single-quoted strings)."""
from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "deploy/wp-content/mu-plugins"

# Lines that look like broken PHP string literals from encoding corruption.
BAD_LINE = re.compile(r"^\s*[^#]*'[^']*\ufffd[^']*$")
BAD_LINE2 = re.compile(r"^\s*[^#]*'\s*\.\s*\$")


def check_file(path: Path) -> list[str]:
    issues: list[str] = []
    text = path.read_text(encoding="utf-8")
    in_php = False
    for i, line in enumerate(text.splitlines(), 1):
        if "<?php" in line:
            in_php = True
        if in_php and BAD_LINE.search(line):
            issues.append(f"{path}:{i}: suspicious unclosed/corrupt string")
        if in_php and line.rstrip().endswith("?,"):
            issues.append(f"{path}:{i}: trailing ?, (likely corrupt)")
    return issues


def main() -> int:
    issues: list[str] = []
    for path in sorted(ROOT.rglob("*.php")):
        issues.extend(check_file(path))
    if issues:
        for item in issues:
            print(item)
        return 1
    print(f"ok ({len(list(ROOT.rglob('*.php')))} files)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
