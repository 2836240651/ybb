#!/usr/bin/env python3
"""Fix encoding corruption in tab-audit.php."""
from __future__ import annotations

import re
from pathlib import Path

TARGET = Path(__file__).resolve().parents[1] / (
    "deploy/wp-content/mu-plugins/ybb-site-manager/includes/admin/tab-audit.php"
)

EXACT = [
    ("'success' => '\ufffd?,", "'success' => '✅',"),
    ("'failed' => '\ufffd?,", "'failed' => '❌',"),
    ("'running' => '\ufffd?,", "'running' => '🔄',"),
    ("<label>状\ufffd?", "<label>状态\n                "),
    ("进行\ufffd?/option>", "进行中</option>"),
    ("筛\ufffd?,", "筛选',"),
    ("<option value=\"7\" <?php selected($days, 7); ?>>\ufffd?7 \ufffd?/option>", "<option value=\"7\" <?php selected($days, 7); ?>>近 7 天</option>"),
    ("<option value=\"30\" <?php selected($days, 30); ?>>\ufffd?30 \ufffd?/option>", "<option value=\"30\" <?php selected($days, 30); ?>>近 30 天</option>"),
    ("<option value=\"90\" <?php selected($days, 90); ?>>\ufffd?90 \ufffd?/option>", "<option value=\"90\" <?php selected($days, 90); ?>>近 90 天</option>"),
    ("<p class=\"description\">\ufffd?<?php", "<p class=\"description\">共 <?php"),
    ("保留最\ufffd?<?php", "保留最近 <?php"),
    ("<?php echo (int) YBB_SM_AUDIT_MAX_ENTRIES; ?> \ufffd?/", "<?php echo (int) YBB_SM_AUDIT_MAX_ENTRIES; ?> 条 /"),
    ("Runner 完成\ufffd?/p>", "Runner 完成。</p>"),
    ("操作\ufffd?/th>", "操作人</th>"),
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
    text = TARGET.read_text(encoding="utf-8")
    for old, new in EXACT:
        if old in text:
            text = text.replace(old, new)
        else:
            alt = old.replace("\ufffd", "")
            if alt in text:
                text = text.replace(alt, new)

    lines_out = []
    for line in text.splitlines():
        fixed = line
        if odd_single_quotes(fixed):
            fixed = re.sub(r"'\ufffd\?,", "',", fixed)
            fixed = re.sub(r"'\ufffd\?;", "';'", fixed)
        lines_out.append(fixed)
    text = "\n".join(lines_out) + "\n"
    TARGET.write_text(text, encoding="utf-8")

    bad = [i for i, ln in enumerate(text.splitlines(), 1) if odd_single_quotes(ln) and ln.strip()]
    print("remaining", len(bad))
    return 1 if bad else 0


if __name__ == "__main__":
    raise SystemExit(main())
