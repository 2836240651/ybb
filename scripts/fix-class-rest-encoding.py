#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path

TARGET = Path(__file__).resolve().parents[1] / (
    "deploy/wp-content/mu-plugins/ybb-site-manager/includes/class-rest.php"
)

FIXES: dict[int, str] = {
    168: "                    'sync' => '正在从 WooCommerce 同步产品数据…',",
    169: "                    'build' => '正在构建静态站…',",
    170: "                    'audit' => '正在审计部署包…',",
    171: "                    'upload' => '正在上传静态文件…',",
    172: "                    'browser' => '等待浏览器解压上传（若遇 Captcha 需人工）…',",
    174: "                $label = $stepLabels[$step] ?? ('部署步骤：' . $step);",
    254: "                        : '站点部署已完成';",
    267: "                        '部署失败：' . $friendly,",
}


def main() -> int:
    lines = TARGET.read_text(encoding="utf-8").splitlines()
    for ln, content in FIXES.items():
        lines[ln - 1] = content
    TARGET.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"fixed {TARGET}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
