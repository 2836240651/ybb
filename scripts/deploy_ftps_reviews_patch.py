#!/usr/bin/env python3
"""FTPS bulk upload for product reviews routes �?**after single-SKU trial passes**.

Do NOT run this before:
  py scripts/deploy_ftps_single_product.py --handle <pilot> --dry-run
  py scripts/deploy_ftps_single_product.py --handle <pilot>
  (acceptance on pilot PDP + reviews.html)

**全站铺开�?89 SKU）优先：** `audit-deploy-package.py` �?全量 zip
（`deploy-siteground-browser.ps1`）。本脚本 ~2000 文件 FTPS 队列仅紧急备用�?
See ybb-site AGENTS.md →「单 SKU 试错部署�?「全�?zip 部署经验�?026-06）�?
"""
from __future__ import annotations

import json
import re
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from deploy_ftps import _upload_file, connect_ftps, load_secrets, reconnect
from deploy_upload import collect_local_files, LocalFile

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "out"
MANIFEST = ROOT / "deploy" / "upload-manifest.json"


def load_manifest_files() -> dict:
    if not MANIFEST.exists():
        return {}
    return json.loads(MANIFEST.read_text(encoding="utf-8")).get("files", {})


def chunk_refs_from_html(path: Path) -> set[str]:
    text = path.read_text(encoding="utf-8", errors="ignore")
    refs = set(re.findall(r"/_next/static/[^\s\"'>]+", text))
    return {ref.lstrip("/") for ref in refs}


def plan_reviews_patch() -> list[LocalFile]:
    manifest = load_manifest_files()
    all_local = {f.rel: f for f in collect_local_files()}
    upload: dict[str, LocalFile] = {}

    for rel, item in all_local.items():
        if not rel.startswith("products/"):
            continue
        prev = manifest.get(rel)
        if prev is None or prev.get("size") != item.size:
            upload[rel] = item

    # Shared runtime referenced by updated product/review HTML.
    for seed in [OUT / "index.html", OUT / "products/tz-zbsb-055.html", OUT / "products/reviews/tz-zbsb-055.html"]:
        if seed.is_file():
            for rel in chunk_refs_from_html(seed):
                if rel in all_local:
                    upload[rel] = all_local[rel]

    # Any new/changed chunk assets (badge + reviews route bundles).
    for rel, item in all_local.items():
        if not rel.startswith("_next/static/"):
            continue
        prev = manifest.get(rel)
        if prev is None or prev.get("size") != item.size:
            upload[rel] = item

    return sorted(upload.values(), key=lambda item: item.rel)


def main() -> int:
    dry_run = "--dry-run" in sys.argv
    items = plan_reviews_patch()
    print(f"[reviews-patch] planned upload: {len(items)} files", flush=True)
    kinds = {"products": 0, "chunks": 0, "other": 0}
    for item in items:
        if item.rel.startswith("products/"):
            kinds["products"] += 1
        elif item.rel.startswith("_next/"):
            kinds["chunks"] += 1
        else:
            kinds["other"] += 1
    print(f"[reviews-patch] breakdown: {kinds}", flush=True)

    if dry_run:
        for item in items[:15]:
            print(f"  {item.rel} ({item.size})", flush=True)
        if len(items) > 15:
            print(f"  ... +{len(items) - 15} more", flush=True)
        return 0

    ftp = load_secrets()["ftp"]
    remote_root = ftp["remoteRoot"].rstrip("/")
    client = connect_ftps(ftp)
    try:
        for i, item in enumerate(items, 1):
            try:
                _upload_file(client, remote_root, item.path, item.rel)
            except Exception as exc:
                print(f"[retry] {item.rel}: {exc!r}", flush=True)
                client = reconnect(client, ftp)
                _upload_file(client, remote_root, item.path, item.rel)
            if i % 50 == 0 or i == len(items):
                print(f"[progress] {i}/{len(items)}", flush=True)
        print("[reviews-patch] done", flush=True)
        return 0
    finally:
        try:
            client.quit()
        except Exception:
            pass


if __name__ == "__main__":
    raise SystemExit(main())
