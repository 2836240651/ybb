#!/usr/bin/env python3
"""Fix encoding-corrupted PHP string literal in tab-products.php (fatal parse error)."""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TARGET = (
    ROOT
    / "deploy/wp-content/mu-plugins/ybb-site-manager/includes/admin/tab-products.php"
)

BROKEN = re.compile(
    r"(\(\$indexMeta\['lastBuiltAt'\] \?\? ').+?\)\); \?></code>"
)
FIXED = r"\1—')); ?></code>"


def main() -> int:
    text = TARGET.read_text(encoding="utf-8")
    new, count = BROKEN.subn(FIXED, text)
    if count != 1:
        print(f"Expected 1 replacement, got {count}", flush=True)
        for i, line in enumerate(text.splitlines(), 1):
            if "lastBuiltAt" in line:
                print(f"line {i}: {line!r}")
        return 1
    TARGET.write_text(new, encoding="utf-8")
    print(f"fixed {TARGET}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
