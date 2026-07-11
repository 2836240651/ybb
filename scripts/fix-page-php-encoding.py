#!/usr/bin/env python3
"""Repair encoding-corrupted PHP in ybb-site-manager includes/admin/page.php."""
from __future__ import annotations

import re
from pathlib import Path

TARGET = Path(__file__).resolve().parents[1] / (
    "deploy/wp-content/mu-plugins/ybb-site-manager/includes/admin/page.php"
)

EXACT: list[tuple[str, str]] = [
    ("'contact' => '联系\ufffd?,", "'contact' => '联系',"),
    ("'deploy' => '部署状\ufffd?,", "'deploy' => '部署状态',"),
    ("<p>设置已保存\ufffd?/p>", "<p>设置已保存。</p>"),
    ("<p>已恢复默认\ufffd?/p>", "<p>已恢复默认。</p>"),
    ("<p>部署任务已入队\ufffd?/p>", "<p>部署任务已入队。</p>"),
    ("'恢复\ufffd?Tab 默认'", "'恢复本 Tab 默认'"),
    ("confirm('确定恢复默认\ufffd?);", "confirm('确定恢复默认？');"),
    ("REST 示例\ufffd?code>", "REST 示例：<code>"),
    ("旧菜\ufffd?YBB", "旧菜单 YBB"),
    ("首页模块」Tab 编辑\ufffd?", "首页模块」Tab 编辑。"),
    ("0 个已发布（publish）商\ufffd?/strong>", "0 个已发布（publish）商品</strong>"),
    ("将进入空列表页\ufffd?/p>", "将进入空列表页。</p>"),
    ("执行静态站重建\ufffd?code>", "执行静态站重建（<code>"),
    ("run-catalog-rebuild.ps1</code>）\ufffd?/p>", "run-catalog-rebuild.ps1</code>）。</p>"),
    ("保存后前\ufffd?Header", "保存后前台 Header"),
    ("无需重新部署静态站\ufffd?/p>", "无需重新部署静态站。</p>"),
    ("显示公告\ufffd?/label>", "显示公告栏</label>"),
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

    lines_out: list[str] = []
    for line in text.splitlines():
        fixed = line
        if odd_single_quotes(fixed):
            fixed = re.sub(r"'\ufffd\?,", "',", fixed)
            fixed = re.sub(r"'\ufffd\?;", "';'", fixed)
            fixed = re.sub(r" \ufffd\?'", " → '", fixed)
        lines_out.append(fixed)

    text = "\n".join(lines_out) + "\n"
    TARGET.write_text(text, encoding="utf-8")

    remaining = [no for no, ln in enumerate(text.splitlines(), 1) if odd_single_quotes(ln) and ln.strip()]
    print(f"remaining_odd_quote_lines={len(remaining)}")
    for no in remaining[:20]:
        print(f"  {no}: {text.splitlines()[no-1][:120]}")
    return 1 if remaining else 0


if __name__ == "__main__":
    raise SystemExit(main())
