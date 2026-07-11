#!/usr/bin/env python3
"""Export remaining review rows, upload images to WP media, write CSV batches."""
from __future__ import annotations

import argparse
import csv
import hashlib
import json
import mimetypes
import re
import sys
import time
from pathlib import Path
from urllib.parse import urlparse

import requests

ROOT = Path(__file__).resolve().parents[1]
SKILL_ROOT = ROOT.parents[1]
SECRETS = ROOT / "secrets.local.json"
PRODUCTS_JSON = ROOT / "lib/data/products.json"
CHECKPOINT = SKILL_ROOT / "reports/product-reviews-import/batch-reviews-checkpoint.json"
IMPORT_DIR = SKILL_ROOT / "reports/product-reviews-import"
MEDIA_CACHE = IMPORT_DIR / "media-cache"
MAP_PATH = IMPORT_DIR / "media-url-map.json"
SITE = "https://carp-ybb.com"
CDP_URLS = ("http://127.0.0.1:9224", "http://127.0.0.1:9222")

sys.path.insert(0, str(SKILL_ROOT / "scripts/cross-border-ecom"))
from batch_ybb_product_reviews import (  # noqa: E402
    IMPORT_HEADERS,
    clean_checkpoint,
    competitor_to_import_row,
    load_products,
    raw_to_competitor_row,
)


def fingerprint(handle: str, author: str, content: str) -> str:
    body = re.sub(r"<[^>]+>", "", content or "")
    body = body.strip()[:80]
    return f"{handle}|{author.strip()}|{body}"


def load_imported_fingerprints() -> set[str]:
    paths = [
        IMPORT_DIR / "all-products-reviews-import-20260710.csv",
        IMPORT_DIR / "all-products-reviews-import-batch1-20260710.csv",
        IMPORT_DIR / "all-products-reviews-import-batch2-20260710.csv",
    ]
    seen: set[str] = set()
    for path in paths:
        if not path.is_file():
            continue
        with path.open(encoding="utf-8-sig", newline="") as fh:
            for row in csv.DictReader(fh):
                seen.add(
                    fingerprint(
                        row.get("product_handle", ""),
                        row.get("author", ""),
                        row.get("content", ""),
                    )
                )
    return seen


def export_remaining_rows() -> list[list[str]]:
    cp = clean_checkpoint(json.loads(CHECKPOINT.read_text(encoding="utf-8")))
    products = {p["sku"]: p for p in load_products()}
    imported = load_imported_fingerprints()
    rows: list[list[str]] = []
    for sku, raw_rows in cp.get("done", {}).items():
        product = products.get(sku)
        if not product:
            continue
        for raw in raw_rows:
            comp = raw_to_competitor_row(raw, 0)
            row = competitor_to_import_row(product, comp)
            fp = fingerprint(row[0], row[3], row[6])
            if fp in imported:
                continue
            rows.append(row)
    return rows


def collect_image_urls(rows: list[list[str]]) -> list[str]:
    urls: list[str] = []
    seen: set[str] = set()
    for row in rows:
        for idx in (8, 9, 10):
            url = (row[idx] or "").strip()
            if not url or not url.startswith("http"):
                continue
            if url in seen:
                continue
            seen.add(url)
            urls.append(url)
    return urls


def download_images(urls: list[str]) -> dict[str, Path]:
    MEDIA_CACHE.mkdir(parents=True, exist_ok=True)
    local: dict[str, Path] = {}
    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
            "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
        )
    }
    for i, url in enumerate(urls, 1):
        h = hashlib.sha256(url.encode()).hexdigest()[:16]
        ext = Path(urlparse(url).path).suffix.lower() or ".jpg"
        if ext not in {".jpg", ".jpeg", ".png", ".webp", ".gif"}:
            ext = ".jpg"
        dest = MEDIA_CACHE / f"review-{h}{ext}"
        if dest.is_file() and dest.stat().st_size > 0:
            local[url] = dest
            continue
        try:
            resp = requests.get(url, headers=headers, timeout=30)
            resp.raise_for_status()
            dest.write_bytes(resp.content)
            local[url] = dest
            print(f"[download] {i}/{len(urls)} {dest.name} ({len(resp.content)}b)", flush=True)
        except Exception as exc:
            print(f"[download] FAIL {url[:80]} -> {exc}", flush=True)
        time.sleep(0.3)
    return local


def upload_media_cdp(local_files: dict[str, Path]) -> dict[str, str]:
    if MAP_PATH.is_file():
        url_map: dict[str, str] = json.loads(MAP_PATH.read_text(encoding="utf-8"))
    else:
        url_map = {}

    pending = {u: p for u, p in local_files.items() if u not in url_map}
    if not pending:
        print(f"[media] all {len(url_map)} urls already mapped", flush=True)
        return url_map

    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        raise SystemExit("pip install playwright")

    with sync_playwright() as p:
        browser = None
        for cdp in CDP_URLS:
            try:
                browser = p.chromium.connect_over_cdp(cdp)
                print(f"[media] CDP {cdp}", flush=True)
                break
            except Exception:
                continue
        if browser is None:
            raise SystemExit("CDP unavailable — run: node scripts/open-wp-admin-chrome.mjs")

        ctx = browser.contexts[0] if browser.contexts else browser.new_context()
        page = ctx.pages[0] if ctx.pages else ctx.new_page()
        page.goto(f"{SITE}/wp-admin/", wait_until="domcontentloaded", timeout=120000)
        page.wait_for_timeout(2000)
        if "wp-login" in page.url:
            raise SystemExit("WP not logged in in CDP Chrome")

        nonce = page.evaluate("() => window.wpApiSettings?.nonce || ''")
        if not nonce:
            raise SystemExit("REST nonce missing on wp-admin")

        for i, (src_url, path) in enumerate(pending.items(), 1):
            mime, _ = mimetypes.guess_type(path.name)
            mime = mime or "image/jpeg"
            buffer = path.read_bytes()
            upload_name = path.name
            resp = page.request.post(
                f"{SITE}/wp-json/wp/v2/media",
                headers={
                    "X-WP-Nonce": nonce,
                    "Content-Disposition": f'attachment; filename="{upload_name}"',
                },
                multipart={
                    "file": {"name": upload_name, "mimeType": mime, "buffer": buffer},
                },
                timeout=120000,
            )
            if resp.status >= 400:
                print(f"[media] FAIL {upload_name} HTTP {resp.status}: {resp.text()[:200]}", flush=True)
                continue
            data = resp.json()
            local_url = (data.get("source_url") or "").split("?")[0]
            url_map[src_url] = local_url
            print(f"[media] {i}/{len(pending)} {upload_name} -> {local_url}", flush=True)
            time.sleep(0.2)

    MAP_PATH.write_text(json.dumps(url_map, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return url_map


def patch_rows(rows: list[list[str]], url_map: dict[str, str]) -> list[list[str]]:
    out: list[list[str]] = []
    for row in rows:
        row = list(row)
        for idx in (8, 9, 10):
            src = (row[idx] or "").strip()
            if src in url_map:
                row[idx] = url_map[src]
        out.append(row)
    return out


def write_csv_batches(rows: list[list[str]], stamp: str) -> list[Path]:
    paths: list[Path] = []
    chunks = [rows[i : i + 50] for i in range(0, len(rows), 50)] or [[]]
    for bi, chunk in enumerate(chunks, 1):
        path = IMPORT_DIR / f"all-products-reviews-import-continue-batch{bi}-{stamp}.csv"
        with path.open("w", encoding="utf-8-sig", newline="") as fh:
            w = csv.writer(fh)
            w.writerow(IMPORT_HEADERS)
            w.writerows(chunk)
        paths.append(path)
        print(f"[csv] {path.name} rows={len(chunk)}", flush=True)
    return paths


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--skip-download", action="store_true")
    parser.add_argument("--skip-upload", action="store_true")
    parser.add_argument("--skip-export", action="store_true")
    args = parser.parse_args()

    stamp = time.strftime("%Y%m%d")
    rows = []
    if not args.skip_export:
        rows = export_remaining_rows()
        print(f"[export] remaining rows={len(rows)}", flush=True)
        if not rows:
            print("nothing to import")
            return 0

    if not rows:
        # load from latest continue csv if re-running upload only
        latest = sorted(IMPORT_DIR.glob(f"all-products-reviews-import-continue-batch1-{stamp}.csv"))
        if not latest:
            raise SystemExit("no rows to process")
        with latest[-1].open(encoding="utf-8-sig", newline="") as fh:
            reader = csv.reader(fh)
            next(reader, None)
            rows = list(reader)

    urls = collect_image_urls(rows)
    print(f"[images] unique urls={len(urls)}", flush=True)

    local_files: dict[str, Path] = {}
    if not args.skip_download:
        local_files = download_images(urls)

    url_map = json.loads(MAP_PATH.read_text(encoding="utf-8")) if MAP_PATH.is_file() else {}
    if not args.skip_upload and local_files:
        url_map = upload_media_cdp(local_files)

    patched = patch_rows(rows, url_map)
    paths = write_csv_batches(patched, stamp)
    manifest = {
        "stamp": stamp,
        "rows": len(patched),
        "images_mapped": sum(1 for u in urls if u in url_map),
        "batches": [str(p) for p in paths],
    }
    (IMPORT_DIR / f"continue-import-manifest-{stamp}.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(json.dumps(manifest, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
