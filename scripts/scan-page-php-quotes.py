#!/usr/bin/env python3
"""List PHP-syntax-risk lines in page.php (odd quotes outside HTML)."""
from pathlib import Path

p = Path(__file__).resolve().parents[1] / (
    "deploy/wp-content/mu-plugins/ybb-site-manager/includes/admin/page.php"
)
text = p.read_text(encoding="utf-8")
in_php = False
for i, line in enumerate(text.splitlines(), 1):
    stripped = line.strip()
    if stripped.startswith("<?php"):
        in_php = True
    if stripped.startswith("?>"):
        in_php = False
        continue
    if not in_php:
        continue
    if "<?=" in line or "?>" in line:
        continue
    # count single quotes naive
    q = 0
    j = 0
    while j < len(line):
        if line[j] == "\\":
            j += 2
            continue
        if line[j] == "'":
            q += 1
        j += 1
    if q % 2 == 1:
        print(i, line[:140])
