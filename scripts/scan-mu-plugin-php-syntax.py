#!/usr/bin/env python3
"""Scan mu-plugin patch PHP files for likely parse errors (unclosed string literals)."""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MU = ROOT / "deploy/wp-content/mu-plugins/ybb-site-manager"

PATCH_REL = [
    "ybb-site-manager.php",
    "includes/class-settings.php",
    "includes/class-rest.php",
    "includes/modules/product-index.php",
    "includes/modules/products.php",
    "includes/modules/pdp.php",
    "includes/modules/product-description-editor.php",
    "includes/class-sanitize.php",
    "includes/modules/audit-log.php",
    "includes/admin/tab-products.php",
]

# `?? '...` without closing quote before `));` or `);`
SUSPECT = re.compile(r"\?\? '[^'\n]{0,40}\)\);")


def main() -> int:
    issues = 0
    for rel in PATCH_REL:
        path = MU / rel
        text = path.read_text(encoding="utf-8")
        for mno, line in enumerate(text.splitlines(), 1):
            if SUSPECT.search(line):
                print(f"{rel}:{mno}: {line.strip()[:120]}")
                issues += 1
            if "?? '" in line and line.count("'") % 2 == 1 and "?>" not in line:
                # odd quotes on a PHP line
                if "placeholder" not in line and "esc_attr" not in line:
                    print(f"{rel}:{mno} ODD_QUOTES: {line.strip()[:120]}")
                    issues += 1
    print(f"issues={issues}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
