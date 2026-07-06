#!/usr/bin/env python3
"""Pack mu-plugins into zip for SiteGround File Manager Extract upload."""
from __future__ import annotations

import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MU = ROOT / "deploy" / "wp-content" / "mu-plugins"
OUT = ROOT / "deploy" / "ybb-contact-mu-plugins.zip"
README = ROOT / "deploy" / "README-contact-mu-upload.txt"


def zip_dir(zf: zipfile.ZipFile, src_dir: Path, arc_prefix: str) -> int:
    count = 0
    for path in sorted(src_dir.rglob("*")):
        if not path.is_file():
            continue
        rel = path.relative_to(src_dir).as_posix()
        arc = f"{arc_prefix}/{rel}" if arc_prefix else rel
        zf.write(path, arc)
        count += 1
    return count


def main() -> int:
    files = 0
    OUT.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(OUT, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        inquiry = MU / "ybb-contact-inquiry.php"
        if inquiry.is_file():
            zf.write(inquiry, "ybb-contact-inquiry.php")
            files += 1
        sm = MU / "ybb-site-manager"
        if sm.is_dir():
            files += zip_dir(zf, sm, "ybb-site-manager")

    README.write_text(
        "\n".join(
            [
                "carp-ybb Contact 后台配置 mu-plugin 上传包",
                "",
                "【用法】",
                "1. SiteGround File Manager → public_html/wp-content/mu-plugins/",
                "2. 上传 ybb-contact-mu-plugins.zip",
                "3. 右键 Extract 解压到当前目录（mu-plugins）",
                "4. 确认存在 ybb-site-manager/ 与 ybb-contact-inquiry.php",
                "5. 删除 zip 文件",
                "6. WP 后台 → YBB 站点管理 → 联系页 可编辑文案与销售邮箱",
                "",
                f"打包文件数: {files}",
                f"输出: {OUT}",
            ]
        ),
        encoding="utf-8",
    )

    print(OUT)
    print(f"files={files}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
