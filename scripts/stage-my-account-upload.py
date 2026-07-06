#!/usr/bin/env python3
"""Stage ybb-my-account mu-plugin for SiteGround upload."""
from __future__ import annotations

import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "deploy" / "wp-content" / "mu-plugins"
STAGE = ROOT / "deploy" / "siteground-upload-my-account"


def main() -> int:
    if STAGE.exists():
        shutil.rmtree(STAGE)
    STAGE.mkdir(parents=True)

    loader = SRC / "ybb-my-account.php"
    plugin_dir = SRC / "ybb-my-account"
    if not loader.is_file() or not plugin_dir.is_dir():
        print("Missing deploy/wp-content/mu-plugins/ybb-my-account*", flush=True)
        return 1

    shutil.copy2(loader, STAGE / "ybb-my-account.php")
    shutil.copytree(plugin_dir, STAGE / "ybb-my-account")

    readme = STAGE / "README-上传说明.txt"
    readme.write_text(
        "\n".join(
            [
                "YBB My Account mu-plugin 上传�?,
                "",
                "【用法�?,
                "1. SiteGround File Manager �?public_html/wp-content/mu-plugins/",
                "2. 上传本目录内�?,
                "   - ybb-my-account.php",
                "   - ybb-my-account/ 整个文件�?,
                "3. 勿把整个 siteground-upload-my-account 文件夹拖�?mu-plugins",
                "4. SiteGround �?Speed �?Caching �?Purge All",
                "5. 验收�?,
                "   - /my-account/ 背景与首页一致（钓场�?+ 白色蒙层�?,
                "   - 顶部横向站点导航 + 账户子菜单横�?pill",
                "   - 页面 HTML �?class ybb-account-page",
            ]
        ),
        encoding="utf-8",
    )

    count = sum(1 for p in STAGE.rglob("*") if p.is_file())
    print(STAGE)
    print(f"files={count}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
