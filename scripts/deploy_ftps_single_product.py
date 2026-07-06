#!/usr/bin/env python3
"""FTPS upload ONE product handle + its shared chunk deps (trial deploy).

Usage:
  py scripts/deploy_ftps_single_product.py --handle tz-eldz-012 --dry-run
  py scripts/deploy_ftps_single_product.py --handle tz-eldz-012
  py scripts/deploy_ftps_single_product.py --handle tz-eldz-012 --no-reviews

See ybb-site AGENTS.md →「单 SKU 试错部署（硬性）�?
"""
from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from deploy_ftps import _upload_file, connect_ftps, load_secrets, reconnect
from deploy_upload import LocalFile, collect_local_files

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "out"


def chunk_refs_from_html(path: Path) -> set[str]:
    text = path.read_text(encoding="utf-8", errors="ignore")
    refs = set(re.findall(r"/_next/static/[^\s\"'>]+", text))
    return {ref.lstrip("/") for ref in refs}


def plan_single_product(handle: str, *, include_reviews: bool) -> list[LocalFile]:
    all_local = {f.rel: f for f in collect_local_files()}
    upload: dict[str, LocalFile] = {}

    rel_paths = [f"products/{handle}.html"]
    if include_reviews:
        rel_paths.append(f"products/reviews/{handle}.html")

    chunk_rels: set[str] = set()
    for rel in rel_paths:
        path = OUT / rel
        if not path.is_file():
            raise FileNotFoundError(f"missing {path} �?run npm run build first")
        upload[rel] = all_local[rel]
        chunk_rels |= chunk_refs_from_html(path)

    for rel in sorted(chunk_rels):
        if rel in all_local:
            upload[rel] = all_local[rel]

    return sorted(upload.values(), key=lambda item: item.rel)


def main() -> int:
    parser = argparse.ArgumentParser(description="FTPS upload one product + chunk deps")
    parser.add_argument("--handle", required=True, help="product handle, e.g. tz-eldz-012")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument(
        "--no-reviews",
        action="store_true",
        help="skip products/reviews/{handle}.html",
    )
    args = parser.parse_args()

    if not OUT.is_dir():
        print("Missing out/. Run npm run build first.", file=sys.stderr)
        return 1

    try:
        items = plan_single_product(args.handle, include_reviews=not args.no_reviews)
    except FileNotFoundError as exc:
        print(exc, file=sys.stderr)
        return 1

    product_files = [i for i in items if i.rel.startswith("products/")]
    chunk_files = [i for i in items if i.rel.startswith("_next/")]
    print(
        f"[single-product] handle={args.handle} total={len(items)} "
        f"(html={len(product_files)} chunks={len(chunk_files)})",
        flush=True,
    )

    for item in items:
        print(f"  {item.rel} ({item.size})", flush=True)

    if args.dry_run:
        print("[single-product] dry-run only", flush=True)
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
            print(f"[progress] {i}/{len(items)} {item.rel}", flush=True)
        print("[single-product] done", flush=True)
        return 0
    finally:
        try:
            client.quit()
        except Exception:
            pass


if __name__ == "__main__":
    raise SystemExit(main())
