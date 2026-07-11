#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MU = ROOT / "deploy/wp-content/mu-plugins/ybb-site-manager"

EXTRA = [
    "includes/migrate.php",
    "includes/defaults.php",
    "includes/modules/product-description-editor.php",
    "includes/class-settings.php",
    "ybb-site-manager-loader.php",
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
    for rel in EXTRA:
        path = MU.parent / rel if rel == "ybb-site-manager-loader.php" else MU / rel
        if not path.is_file():
            print(f"MISSING {rel}")
            continue
        for no, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
            if odd_single_quotes(line) and line.strip():
                print(f"{rel}:{no}: {line[:120]}")
                issues += 1
    print(f"issues={issues}")
    return issues


if __name__ == "__main__":
    raise SystemExit(main())
