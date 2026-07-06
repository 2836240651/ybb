#!/usr/bin/env python3
"""Pack minimal PRI (product reviews Excel import) mu-plugin patch for SiteGround."""
from __future__ import annotations

import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MU = ROOT / "deploy" / "wp-content" / "mu-plugins"
OUT = ROOT / "deploy" / "ybb-reviews-import-patch.zip"
README = ROOT / "deploy" / "README-reviews-import-mu-upload.txt"

PATCH_FILES: list[tuple[Path, str]] = [
    (MU / "ybb-product-reviews.php", "ybb-product-reviews.php"),
    (
        MU / "ybb-site-manager" / "includes" / "admin" / "page.php",
        "ybb-site-manager/includes/admin/page.php",
    ),
    (
        MU / "ybb-site-manager" / "includes" / "modules" / "audit-log.php",
        "ybb-site-manager/includes/modules/audit-log.php",
    ),
]


def zip_dir(zf: zipfile.ZipFile, src_dir: Path, arc_prefix: str) -> int:
    count = 0
    for path in sorted(src_dir.rglob("*")):
        if not path.is_file():
            continue
        rel = path.relative_to(src_dir).as_posix()
        arc = f"{arc_prefix}/{rel}"
        zf.write(path, arc)
        count += 1
    return count


def main() -> int:
    missing = [str(p) for p, _ in PATCH_FILES if not p.is_file()]
    pr_dir = MU / "ybb-product-reviews"
    if not pr_dir.is_dir():
        missing.append(str(pr_dir))
    if missing:
        print("Missing:", ", ".join(missing), flush=True)
        return 1

    OUT.parent.mkdir(parents=True, exist_ok=True)
    file_count = 0
    with zipfile.ZipFile(OUT, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        for local, arc in PATCH_FILES:
            zf.write(local, arc)
            file_count += 1
        file_count += zip_dir(zf, pr_dir, "ybb-product-reviews")

    README.write_text(
        "\n".join(
            [
                "carp-ybb 评价 Excel 批量导入 �?最�?mu-plugin 补丁",
                "",
                "【用法�?,
                "1. SiteGround File Manager �?public_html/wp-content/mu-plugins/",
                "2. 上传 ybb-reviews-import-patch.zip",
                "3. 右键 Extract 解压到当前目录（mu-plugins�?,
                "4. 确认存在�?,
                "   - ybb-product-reviews.php（Version 1.2.0�?,
                "   - ybb-product-reviews/includes/review-import-*.php",
                "   - ybb-site-manager/includes/admin/page.php（含 reviews-import Tab�?,
                "5. 删除 zip",
                "6. WP �?YBB 站点管理 �?评价导入",
                "",
                "【数据】本�?xlsx 后台上传即可，无需 rebuild 静态站",
                "   reports/product-reviews-import/tz-hk-001-reviews-import-*.xlsx",
                "",
                f"打包文件�? {file_count}",
                f"输出: {OUT}",
            ]
        ),
        encoding="utf-8",
    )

    print(OUT)
    print(f"files={file_count}")
    print(README)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
