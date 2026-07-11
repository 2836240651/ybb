#!/usr/bin/env python3
"""Print relative paths (from out/) for incremental i18n patch chunks."""

from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "out"
MANIFEST = ROOT / "deploy" / "upload-manifest.json"

refs: set[str] = set()
for html in OUT.rglob("*.html"):
    text = html.read_text(encoding="utf-8", errors="replace")
    refs.update(re.findall(r"/_next/static/chunks/([^\"?]+)", text))

m = re.search(r"<!--([^>]+)-->", (OUT / "index.html").read_text(encoding="utf-8"))
build_id = m.group(1) if m else ""

old = json.loads(MANIFEST.read_text(encoding="utf-8")) if MANIFEST.exists() else {"files": {}}
old_files = set(old.get("files", {}).keys())

new_paths = {f"_next/static/chunks/{r}" for r in refs}
new_paths.add(f"_next/static/{build_id}/_buildManifest.js")
new_paths.add(f"_next/static/{build_id}/_ssgManifest.js")

for rel in sorted(new_paths - old_files):
    disk = OUT / rel
    if disk.exists():
        print(rel.replace("\\", "/"))
