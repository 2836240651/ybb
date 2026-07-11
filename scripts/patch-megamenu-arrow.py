from pathlib import Path

path = Path(__file__).resolve().parents[1] / "components/layout/MegaMenu.tsx"
lines = path.read_text(encoding="utf-8").splitlines(keepends=True)
out = []
i = 0
while i < len(lines):
    line = lines[i]
    if "All {viewAllLabel}" in line:
        out.append(line)
        i += 1
        out.append(
            '                        {productCount > 0 ? ` (${productCount})` : ""} {MENU_ARROW}\n'
        )
        while i < len(lines) and "</HardNavLink>" not in lines[i]:
            i += 1
        if i < len(lines):
            out.append("                      </HardNavLink>\n")
            i += 1
        continue
    out.append(line)
    i += 1

path.write_text("".join(out), encoding="utf-8")
print("patched MegaMenu view-all arrow")
