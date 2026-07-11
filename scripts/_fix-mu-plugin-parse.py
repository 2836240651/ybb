#!/usr/bin/env python3
"""Repair UTF-8 corruption that breaks PHP parse in mu-plugin files."""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "deploy/wp-content/mu-plugins/ybb-site-manager"


def fix_audit_log() -> None:
    path = ROOT / "includes/modules/audit-log.php"
    text = path.read_text(encoding="utf-8")

    replacements = [
        (
            "$lines[] = '  + 新增公告\ufffd? . $id . '\ufffd?;",
            "$lines[] = '  + 新增公告：' . $id;",
        ),
        (
            "$lines[] = '  - 已移除公告\ufffd? . $id . '\ufffd?;",
            "$lines[] = '  - 已移除公告：' . $id;",
        ),
        (
            "$lines[] = '  + 新增轮播\ufffd? . $name . '\ufffd?;",
            "$lines[] = '  + 新增轮播：' . $name;",
        ),
        (
            "$lines[] = '  + 新增文章\ufffd? . $name . '\ufffd?;",
            "$lines[] = '  + 新增文章：' . $name;",
        ),
        (
            "$lines[] = '  + 覆盖\ufffd? . $handle . '\ufffd?;",
            "$lines[] = '  + 覆盖：' . $handle;",
        ),
        (
            "$lines[] = '  - 移除覆盖\ufffd? . $handle . '\ufffd?;",
            "$lines[] = '  - 移除覆盖：' . $handle;",
        ),
        (
            "$lines[] = '  · 更新覆盖\ufffd? . $handle . '\ufffd?;",
            "$lines[] = '  · 更新覆盖：' . $handle;",
        ),
    ]
    for old, new in replacements:
        if old in text:
            text = text.replace(old, new)
        else:
            # tolerate literal replacement char display
            alt_old = old.replace("\ufffd", "\ufffd")
            if alt_old not in text:
                print(f"WARN missing pattern: {old[:40]}...")

    text = re.sub(
        r"\$lines\[\] = '顶部导航：显\ufffd\?' \. \$aVisible \. ' 项（\ufffd\?' \. \$bVisible \. ' 项）';",
        "$lines[] = '顶部导航：显示 ' . $aVisible . ' 项（原 ' . $bVisible . ' 项）';",
        text,
    )
    text = re.sub(
        r"\$lines\[\] = '轮播图：' \. count\(\$as\) \. ' 张（\ufffd\?' \. count\(\$bs\) \. ' 张）';",
        "$lines[] = '轮播图：' . count($as) . ' 张（原 ' . count($bs) . ' 张）';",
        text,
    )
    text = re.sub(
        r"\$lines\[\] = '  · 主推产品：' \. \(\$b\['handle'\] \?\? '（空\ufffd\?\) \. ' → ' \. \(\$a\['handle'\] \?\? '（空\ufffd\?\);",
        "$lines[] = '  · 主推产品：' . ($b['handle'] ?? '（空）') . ' → ' . ($a['handle'] ?? '（空）');",
        text,
    )

  # Generic: broken string where \ufffd? closes early before concatenation
    def fix_broken_concat(m: re.Match[str]) -> str:
        prefix = m.group(1)
        var = m.group(2)
        return f"$lines[] = '{prefix}' . {var};"

    text = re.sub(
        r"\$lines\[\] = '([^']*\ufffd)\? \. (\$[a-zA-Z_][\w\[\]'\"]+) \. '\ufffd\?;",
        fix_broken_concat,
        text,
    )

    path.write_text(text, encoding="utf-8")
    print("fixed audit-log.php")


def fix_products() -> None:
    path = ROOT / "includes/modules/products.php"
    text = path.read_text(encoding="utf-8")
    text = text.replace(
        "'主要な特\ufffd? => '主要な特\ufffd?,",
        "'主要な特徴' => '主要な特徴',",
    )
    text = text.replace(
        "'まと\ufffd? => 'まと\ufffd?,",
        "'まとめ' => 'まとめ',",
    )
    text = text.replace(
        'preg_replace(\'/<li[^>]*>(.*?)<\\/li>/is\', "\ufffd?$1\\n", $text);',
        'preg_replace(\'/<li[^>]*>(.*?)<\\/li>/is\', "• $1\\n", $text);',
    )
    path.write_text(text, encoding="utf-8")
    print("fixed products.php")


def scan_parse_breakers() -> list[str]:
    """Find lines likely to break PHP: quote, then . outside string before ;"""
    issues: list[str] = []
    for rel in [
        "includes/modules/audit-log.php",
        "includes/modules/products.php",
        "ybb-site-manager.php",
    ]:
        path = ROOT / rel
        for i, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
            if "\ufffd" in line and re.search(r"'\s*\.", line):
                issues.append(f"{rel}:{i}: {line.strip()[:100]}")
    return issues


def main() -> None:
    fix_products()
    fix_audit_log()
    issues = scan_parse_breakers()
    if issues:
        print("REMAINING SUSPECT LINES:")
        for row in issues:
            print(row)
    else:
        print("no suspect parse-breaker lines")


if __name__ == "__main__":
    main()
