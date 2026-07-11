import json
from pathlib import Path

root = Path(__file__).resolve().parents[1] / "lib"
skip_dirs = {"i18n/dictionaries"}

failed: list[str] = []

for p in sorted(root.rglob("*.json")):
    rel = p.relative_to(root).as_posix()
    if any(rel.startswith(skip) for skip in skip_dirs):
        continue
    try:
        json.loads(p.read_text(encoding="utf-8"))
    except Exception as exc:
        failed.append(f"{rel}: {exc}")

if failed:
    print("Invalid JSON (fix manually; do NOT auto-mangle strings):")
    for line in failed:
        print(" ", line)
    raise SystemExit(1)

print("All lib/*.json valid (i18n/dictionaries skipped)")
