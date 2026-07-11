from pathlib import Path

p = Path(__file__).resolve().parent / "extract-product-images.py"
text = p.read_text(encoding="utf-8", errors="replace")

fixes = [
    (
        '            raise SystemExit(\n                "未找',
        '            raise SystemExit(\n                "未找到 xl/cellimages.xml，该表可能不是 WPS DISPIMG 图片格式"\n            ) from exc\n            # placeholder removed',
    ),
]

# Rebuild broken raise block
import re
text = re.sub(
    r'raise SystemExit\(\s*"未找[^"]*"\s*\) from exc',
    'raise SystemExit(\n                "未找到 xl/cellimages.xml，该表可能不是 WPS DISPIMG 图片格式"\n            ) from exc',
    text,
    count=1,
    flags=re.DOTALL,
)

text = re.sub(
    r'ArgumentParser\(description="提取产品表单图片[^"]*"\)',
    'ArgumentParser(description="提取产品表单图片（按表头识别货号列）")',
    text,
    count=1,
)

text = re.sub(
    r'print\(\s*"提取完成:[^"]*"\s*f"[^"]*"\s*f"[^"]*"\s*\)',
    '''print(
        "提取完成: "
        f"共 {stats['total']} 行, 成功 {stats['ok']}, "
        f"重复跳过 {stats['skipped_dup']}, 无货号 {stats['skipped_no_sku']}, "
        f"缺失 {stats['missing_media']}, 缺表 {stats['missing_sheet']}"
    )''',
    text,
    count=1,
    flags=re.DOTALL,
)

p.write_text(text, encoding="utf-8")
print("patched", p)
