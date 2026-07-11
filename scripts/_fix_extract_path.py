from pathlib import Path
p = Path(__file__).resolve().parent / "extract-product-images.py"
lines = p.read_text(encoding="utf-8", errors="replace").splitlines()
out = []
for line in lines:
    if line.startswith("DEFAULT_OUTPUT = "):
        out.append('DEFAULT_OUTPUT = Path(r"D:\\dev\\独立站上架\\output\\wp\\images")')
    elif "已清空旧图片" in line and line.endswith("?"):
        out.append('        print(f"已清空旧图片: {removed} 张")')
    elif line.strip().startswith('print(f"已清空旧图片'):
        out.append('        print(f"已清空旧图片: {removed} 张")')
    else:
        out.append(line)
p.write_text("\n".join(out) + "\n", encoding="utf-8")
print("fixed", p)
