#!/usr/bin/env python3
"""List static files for manual SiteGround upload after OEM/contact/terms update."""
from __future__ import annotations

import json
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "out"

# Pages touched by this release (HTML must upload).
PAGE_FILES = [
    "pages/private-label.html",
    "pages/private-label.txt",
    "pages/custom-packaging.html",
    "pages/custom-packaging.txt",
    "pages/moq-lead-time.html",
    "pages/moq-lead-time.txt",
    "moq-lead-time.html",
    "moq-lead-time.txt",
    "pages/oem-odm.html",
    "pages/oem-odm.txt",
    "pages/contact.html",
    "pages/contact.txt",
    "contact.html",
    "contact.txt",
    "terms.html",
    "terms.txt",
    "pages/terms.html",
    "pages/terms.txt",
]

# WP one-off (upload to public_html root, run URL, then delete).
WP_SCRIPT = "deploy/update-wp-oem-pages.php"


def chunk_refs(html_path: Path) -> set[str]:
    text = html_path.read_text(encoding="utf-8", errors="replace")
    refs: set[str] = set()
    for part in text.split("/_next/static/chunks/")[1:]:
        name = part.split('"')[0].split("'")[0]
        if name.endswith(".js") or name.endswith(".css"):
            refs.add(f"_next/static/chunks/{name}")
    return refs


def main() -> None:
    build_id_path = OUT / "BUILD_ID"
    build_id = build_id_path.read_text(encoding="utf-8").strip() if build_id_path.exists() else "(unknown)"

    chunks: set[str] = set()
    for rel in PAGE_FILES:
        p = OUT / rel.replace("/", os.sep)
        if p.suffix == ".html" and p.is_file():
            chunks |= chunk_refs(p)

    lines = [
        "# carp-ybb 手动上传清单（OEM 子页 + Contact + Terms�?,
        "",
        f"**Build ID:** `{build_id}`",
        "",
        "## 根因说明",
        "",
        "1. OEM 子页正文此前�?**client-only 渲染**，HTML 壳子里没有正文；浏览器若命中�?JS chunk 会显�?overview�?,
        "2. WordPress 仍存�?`/private-label/` 等旧页面（overview 全文）。需同步 WP 或删除重复页�?,
        "",
        "## 必做步骤",
        "",
        "1. 上传下方 **HTML + JS/CSS chunk** �?SiteGround `public_html`（路径一一对应）�?,
        "2. 上传 `update-wp-oem-pages.php` �?`public_html` 根目录，浏览器访问：",
        "   `https://carp-ybb.com/update-wp-oem-pages.php?key=ybb-migrate-20260626&nocache=1`",
        "3. 确认 JSON 返回 `updated` 含四�?slug �?**删除** �?PHP 文件�?,
        "4. SiteGround �?Speed Optimizer �?**Purge All Cache**�?,
        "5. 无痕窗口验证三个 URL（见文末）�?,
        "",
        "## HTML 页面",
        "",
        "| 本地（绝对路径） | SiteGround `public_html` |",
        "|---|---|",
    ]

    for rel in PAGE_FILES:
        local = OUT / rel.replace("/", os.sep)
        if local.is_file():
            lines.append(f"| `{local}` | `{rel.replace(chr(92), '/')}` |")

    lines += [
        "",
        "## JS / CSS chunk（从 HTML 引用解析，务必整包上传）",
        "",
        "| 本地 | SiteGround |",
        "|---|---|",
    ]
    for rel in sorted(chunks):
        local = OUT / rel.replace("/", os.sep)
        if local.is_file():
            lines.append(f"| `{local}` | `{rel}` |")

    wp_local = ROOT / WP_SCRIPT
    lines += [
        "",
        "## WordPress 同步脚本（一次性）",
        "",
        f"| `{wp_local}` | `update-wp-oem-pages.php` |",
        "",
        "## 验收 URL",
        "",
        "- https://carp-ybb.com/pages/private-label �?H1 **Private Label** + 3 段（�?10,000+ molds�?,
        "- https://carp-ybb.com/pages/custom-packaging �?H1 **Custom Packaging** + FREE design",
        "- https://carp-ybb.com/moq-lead-time �?3 条编�?MOQ/交期",
        "- https://carp-ybb.com/pages/contact �?电话 **13052997260**、公�?**杭州拓钓渔具用品**",
        "- https://carp-ybb.com/terms �?**Terms of Service** / Last Updated: June 2026",
        "",
    ]

    report = ROOT / "reports" / "deploy-oem-contact-terms.md"
    report.parent.mkdir(parents=True, exist_ok=True)
    report.write_text("\n".join(lines), encoding="utf-8")
    print(report)
    print(f"buildId={build_id} html={sum(1 for r in PAGE_FILES if (OUT / r).is_file())} chunks={len(chunks)}")


if __name__ == "__main__":
    main()
