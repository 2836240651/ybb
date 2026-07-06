#!/usr/bin/env python3
"""Stage ybb-flat-checkout mu-plugin for SiteGround upload (mirrors wp-content/mu-plugins)."""
from __future__ import annotations

import os
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "deploy" / "wp-content" / "mu-plugins"
STAGE = ROOT / "deploy" / "siteground-upload-flat-checkout"


def main() -> int:
    if STAGE.exists():
        shutil.rmtree(STAGE)
    STAGE.mkdir(parents=True)

    loader = SRC / "ybb-flat-checkout.php"
    flat_dir = SRC / "ybb-flat-checkout"
    if not loader.is_file() or not flat_dir.is_dir():
        print("Missing deploy/wp-content/mu-plugins/ybb-flat-checkout*", flush=True)
        return 1

    shutil.copy2(loader, STAGE / "ybb-flat-checkout.php")
    shutil.copytree(flat_dir, STAGE / "ybb-flat-checkout")

    readme = STAGE / "README-上传说明.txt"
    readme.write_text(
        "\n".join(
            [
                "YBB Flat Checkout mu-plugin 上传�?,
                "",
                "【用法�?,
                "1. SiteGround File Manager �?public_html/wp-content/mu-plugins/",
                "2. 上传本目录内�?,
                "   - ybb-flat-checkout.php（覆盖）",
                "   - ybb-flat-checkout/ 整个文件夹（覆盖合并�?,
                "3. 勿把整个 siteground-upload-flat-checkout 文件夹拖�?mu-plugins",
                "4. WooCommerce �?Settings �?Accounts：关闭游客结账（Allow guest checkout�?,
                "5. 验收�?,
                "   - 空车访问 /checkout/ �?跳转 /cart/",
                "   - 未登录访�?/checkout/（有车）�?/my-account/?redirect_to=...",
                "   - 登录�?checkout 页有 Back to cart 按钮 + place_order",
                "   - 页面 HTML �?class ybb-checkout-page",
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
