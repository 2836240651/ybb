#!/usr/bin/env python3
"""Targeted variant SKU check for patched products only."""

from __future__ import annotations

import json
import subprocess
import sys
import time
from pathlib import Path
from urllib.parse import urljoin

ROOT = Path(__file__).resolve().parents[1]
PATCH = ROOT / "deploy" / "variation-sku-patch.json"
SITE = "https://carp-ybb.com"


def fetch_sku(wc_id: int) -> str:
    url = urljoin(SITE, f"/index.php?rest_route=/wc/store/v1/products/{wc_id}&nocache={int(time.time()*1000)}")
    proc = subprocess.run(
        ["curl.exe", "-sS", url],
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        timeout=60,
    )
    if proc.returncode != 0:
        raise RuntimeError(proc.stderr.strip() or f"curl failed {wc_id}")
    return str(json.loads(proc.stdout).get("sku") or "")


def main() -> int:
    patch = json.loads(PATCH.read_text(encoding="utf-8"))
    patches = patch.get("patches") or []
    parents = sorted({p["parentSku"] for p in patches})
    print(f"[targeted-sku-audit] parents={len(parents)} patches={len(patches)}")

    fails: list[str] = []
    for i, row in enumerate(patches, 1):
        vid = int(row["variationWcId"])
        target = row["targetSku"]
        parent = row["parentSku"]
        try:
            live = fetch_sku(vid)
        except Exception as exc:
            fails.append(f"{parent} wcId={vid}: {exc}")
            continue
        ok = live == target
        mark = "OK" if ok else "FAIL"
        print(f"  [{mark}] {i}/{len(patches)} {parent} vid={vid} live={live!r} target={target!r}")
        if not ok:
            fails.append(f"{parent} vid={vid}: live={live!r} target={target!r}")

    if fails:
        print(f"[targeted-sku-audit] FAIL {len(fails)}/{len(patches)}")
        return 1
    print(f"[targeted-sku-audit] PASS {len(patches)}/{len(patches)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
