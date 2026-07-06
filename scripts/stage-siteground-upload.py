#!/usr/bin/env python3
"""Stage SiteGround upload files under deploy/siteground-upload/ (mirrors public_html)."""
from __future__ import annotations

import argparse
import os
import re
import shutil
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "out"
STAGE = ROOT / "deploy" / "siteground-upload"

CONTACT_HTML = [
    "pages/contact.html",
    "pages/contact.txt",
    "contact.html",
    "contact.txt",
]

HOME_HTML = [
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


def stage_files(rel_paths: list[str], *, clean: bool) -> list[str]:
    if clean and STAGE.exists():
        shutil.rmtree(STAGE)
    STAGE.mkdir(parents=True, exist_ok=True)

    staged: list[str] = []
    for rel in rel_paths:
        src = OUT / rel.replace("/", os.sep)
        dst = STAGE / rel.replace("/", os.sep)
        if not src.is_file():
            raise FileNotFoundError(src)
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, dst)
        staged.append(rel)
    return staged


def write_readme(lines: list[str]) -> None:
    readme = STAGE / "README-上传说明.txt"
    readme.write_text("\n".join(lines), encoding="utf-8")


def write_zip(staged: list[str], zip_name: str) -> Path:
    zip_path = ROOT / "deploy" / zip_name
    zip_path.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(zip_path, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        for rel in staged:
            src = STAGE / rel.replace("/", os.sep)
            zf.write(src, rel.replace("\\", "/"))
    return zip_path


def cmd_contact(_: argparse.Namespace) -> int:
    html = OUT / "pages" / "contact.html"
    if not html.is_file():
        print("Missing out/pages/contact.html — run npm run build first", flush=True)
        return 1

    match = re.search(r"<!--([^>]+)-->", html.read_text(encoding="utf-8", errors="replace"))
    build_id = match.group(1).strip() if match else "?"

    rels = list(CONTACT_HTML)
    rels.extend(sorted(chunk_refs(html)))
    staged = stage_files(rels, clean=True)

    write_readme(
        [
            "carp-ybb Contact 页增量上传包",
            f"Build ID: {build_id}",
            "",
            "【用法 A — zip 解压（推荐）】",
            "1. 上传 deploy/ybb-contact-static.zip 到 public_html 根目录",
            "2. File Manager 右键 Extract 解压覆盖",
            "3. 删除 zip；Speed Optimizer → Purge All Cache",
            "",
            "【用法 B — 拖文件夹】",
            "1. 选中本目录内除 README 外的全部内容",
            "2. 拖到 public_html 根目录合并覆盖（勿新建子文件夹）",
            "",
            f"文件数: {len(staged)}",
            "",
            "【目录对应】",
            "本地 deploy/siteground-upload/*  →  SiteGround public_html/*",
        ]
    )

    zip_path = write_zip(staged, "ybb-contact-static.zip")
    print(STAGE)
    print(f"buildId={build_id} files={len(staged)} zip={zip_path}")
    return 0


def cmd_home(_: argparse.Namespace) -> int:
    html = OUT / "index.html"
    if not html.is_file():
        print("Missing out/index.html — run npm run build first", flush=True)
        return 1

    match = re.search(r"<!--([^>]+)-->", html.read_text(encoding="utf-8", errors="replace"))
    build_id = match.group(1).strip() if match else "?"

    rels = list(HOME_HTML)
    rels.extend(sorted(chunk_refs(html)))
    staged = stage_files(rels, clean=True)

    write_readme(
        [
            "carp-ybb 首页工厂视频区块上传包",
            f"Build ID: {build_id}",
            "",
            "拖到 public_html 根目录合并覆盖，勿整包拖成 siteground-upload 子目录。",
            f"文件数: {len(staged)}",
        ]
    )

    print(STAGE)
    print(f"buildId={build_id} files={len(staged)}")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Stage SiteGround upload bundle")
    parser.add_argument(
        "target",
        choices=["contact", "home"],
        help="contact=Contact页+chunk; home=首页+视频+chunk",
    )
    args = parser.parse_args()
    if args.target == "contact":
        return cmd_contact(args)
    return cmd_home(args)


if __name__ == "__main__":
    raise SystemExit(main())
