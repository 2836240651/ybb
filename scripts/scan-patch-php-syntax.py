#!/usr/bin/env python3
from __future__ import annotations

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
    "includes/modules/deploy-queue.php",
    "includes/modules/navigation.php",
    "includes/modules/product-description-editor.php",
    "includes/class-sanitize.php",
    "includes/modules/audit-log.php",
    "includes/admin/tab-products.php",
]


def odd_single_quotes(line: str) -> bool:
    count = 0
    i = 0
    while i < len(line):
        if line[i] == "\\":
            i += 2
            continue
        if line[i] == "'":
            count += 1
        i += 1
    return count % 2 == 1


def main() -> int:
    issues = 0
    for rel in PATCH_REL:
        path = MU / rel
        for no, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
            if odd_single_quotes(line) and line.strip():
                print(f"{rel}:{no}: {line[:120]}")
                issues += 1
    print(f"issues={issues}")
    return 0 if issues == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
