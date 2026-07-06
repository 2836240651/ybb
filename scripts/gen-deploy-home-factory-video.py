#!/usr/bin/env python3
"""List static files for manual SiteGround upload after homepage factory video update."""
from __future__ import annotations

import os
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "out"

PAGE_FILES = [
    "index.html",
    "index.txt",
    "videos/factory-showcase.mp4",
]


def chunk_refs(html_path: Path) -> set[str]:
    text = html_path.read_text(encoding="utf-8", errors="replace")
    refs: set[str] = set()
    for part in text.split("/_next/static/chunks/")[1:]:
        name = part.split('"')[0].split("'")[0]
        if name.endswith(".js") or name.endswith(".css"):
            refs.add(f"_next/static/chunks/{name}")
    return refs


def main() -> None:
    index_html = OUT / "index.html"
    build_id = "(unknown)"
    if index_html.is_file():
        match = re.search(r"<!--([^>]+)-->", index_html.read_text(encoding="utf-8", errors="replace"))
        if match:
            build_id = match.group(1).strip()

    chunks: set[str] = set()
    if index_html.is_file():
        chunks = chunk_refs(index_html)

    lines = [
        "# carp-ybb 首页工厂视频区块 �?手动上传清单",
        "",
        f"**Build ID:** `{build_id}`",
        "",
        "## 必传文件",
        "",
        "| 本地全局路径 | SiteGround `public_html` |",
        "|---|---|",
    ]

    for rel in PAGE_FILES:
        local = OUT / rel.replace("/", os.sep)
        if local.is_file():
            lines.append(f"| `{local}` | `{rel.replace(chr(92), '/')}` |")

    lines += [
        "",
        "## JS / CSS chunk（从 index.html 解析，务必上传）",
        "",
        "| 本地全局路径 | SiteGround `public_html` |",
        "|---|---|",
    ]
    for rel in sorted(chunks):
        local = OUT / rel.replace("/", os.sep)
        if local.is_file():
            lines.append(f"| `{local}` | `{rel}` |")

    lines += [
        "",
        "## 上传�?,
        "",
        "1. SiteGround �?Speed Optimizer �?**Purge All Cache**",
        "2. 无痕打开 https://carp-ybb.com/ 滚到底部验证�?,
        "   - 标题 **Precision Manufacturing. Reliable Quality.**",
        "   - 按钮 **Request a Quote**（hover 黑底上滑�?,
        "   - 视频为新工厂�?,
        "",
    ]

    report = ROOT / "reports" / "deploy-home-factory-video.md"
    report.parent.mkdir(parents=True, exist_ok=True)
    report.write_text("\n".join(lines), encoding="utf-8")
    print(report)
    print(f"buildId={build_id} pages={sum(1 for r in PAGE_FILES if (OUT / r).is_file())} chunks={len(chunks)}")


if __name__ == "__main__":
    main()
