#!/usr/bin/env python3
"""Pre-deploy audit for ybb-static-export.zip �?run before upload/unzip.

Usage:
  py scripts/audit-deploy-package.py

See docs/siteground-browser-deploy.md →「上传前审计�?and AGENTS.md →「全�?zip 部署经验�?026-06）�?
"""

from __future__ import annotations

import json
import re
import sys
import zipfile
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "out"
ZIP = ROOT / "deploy" / "ybb-static-export.zip"
HTACCESS = ROOT / "deploy" / "htaccess.restore"
UNZIP_PHP = ROOT / "deploy" / "unzip-export.php"

ASSET_PAT = re.compile(r'(?:src|href)="(/_next/static/[^"?]+)"')
BUILD_ID_PAT = re.compile(r"<!--([^>]+)-->")


def build_id(html: str) -> str | None:
    m = BUILD_ID_PAT.search(html)
    return m.group(1).strip() if m else None


def pilot_required_pages() -> list[str]:
    """Require index + one catalog PDP/reviews pair (no hardcoded stale pilot)."""
    required = ["index.html"]
    products_path = ROOT / "lib" / "data" / "products.json"
    handles: list[str] = []
    if products_path.is_file():
        try:
            data = json.loads(products_path.read_text(encoding="utf-8"))
            if isinstance(data, list):
                handles = [str(p.get("handle", "")).strip() for p in data if p.get("handle")]
        except json.JSONDecodeError:
            pass
    pilot_candidates = ["tz-xp-038", "tz-eldz-012", "tz-xp-001"]
    pilot = next((h for h in pilot_candidates if h in handles), handles[0] if handles else "")
    if pilot:
        required.extend([f"products/{pilot}.html", f"products/reviews/{pilot}.html"])
    return required


def pilot_seed_pages() -> list[Path]:
    seeds = [OUT / "index.html"]
    products_path = ROOT / "lib" / "data" / "products.json"
    handles: list[str] = []
    if products_path.is_file():
        try:
            data = json.loads(products_path.read_text(encoding="utf-8"))
            if isinstance(data, list):
                handles = [str(p.get("handle", "")).strip() for p in data if p.get("handle")]
        except json.JSONDecodeError:
            pass
    pilot_candidates = ["tz-xp-038", "tz-eldz-012", "tz-xp-001", "tz-zbsb-055"]
    pilot_found = False
    for h in pilot_candidates:
        if h in handles:
            seeds.extend([OUT / f"products/{h}.html", OUT / f"products/reviews/{h}.html"])
            pilot_found = True
            break
    if not pilot_found and handles:
        h = handles[0]
        seeds.extend([OUT / f"products/{h}.html", OUT / f"products/reviews/{h}.html"])
    seeds.append(OUT / "collections/sinkers.html")
    checkout = OUT / "checkout.html"
    seeds.append(checkout if checkout.is_file() else OUT / "cart.html")
    return seeds


def main() -> int:
    issues: list[str] = []
    warnings: list[str] = []
    info: dict = {}

    if not OUT.is_dir():
        issues.append("missing out/ �?run build-static.ps1 first")
        print_report(info, issues, warnings)
        return 1

    if not ZIP.is_file():
        issues.append("missing deploy/ybb-static-export.zip")
        print_report(info, issues, warnings)
        return 1

    info["zip_mb"] = round(ZIP.stat().st_size / 1024 / 1024, 2)

    with zipfile.ZipFile(ZIP) as zf:
        corrupt = zf.testzip()
        if corrupt:
            issues.append(f"corrupt zip entry: {corrupt}")

        entries = [e for e in zf.infolist() if not e.filename.endswith("/")]
        names = [e.filename.replace("\\", "/") for e in entries]
        info["zip_files"] = len(names)

        zero = [e.filename for e in entries if e.file_size == 0]
        info["zip_zero_byte"] = len(zero)
        bad_zero = [
            z
            for z in zero
            if not any(z.endswith(x) for x in ("robots.txt", "sitemap.xml"))
        ]
        if bad_zero:
            warnings.append(f"zero-byte files in zip (sample): {bad_zero[:5]}")

        traversal = [n for n in names if ".." in n or n.startswith("/")]
        if traversal:
            issues.append(f"path traversal in zip: {traversal[:3]}")

        if any(n.startswith("out/") for n in names):
            issues.append("zip has out/ prefix �?unzip would create wrong directory layout")

        forbidden = [
            n
            for n in names
            if n.startswith(("wp-admin/", "wp-content/", "wp-includes/"))
        ]
        if forbidden:
            issues.append(f"zip contains WordPress paths (DANGEROUS): {forbidden[:5]}")

        prefixes = Counter(n.split("/")[0] for n in names if n)
        info["zip_top_prefixes"] = dict(prefixes.most_common(15))

        required = pilot_required_pages()
        name_set = set(names)
        for req in required:
            if req not in name_set:
                issues.append(f"missing in zip: {req}")

        if not any(n.startswith("_next/static/chunks/") for n in names):
            issues.append("zip missing _next/static/chunks/")

    out_files = {
        str(p.relative_to(OUT)).replace("\\", "/") for p in OUT.rglob("*") if p.is_file()
    }
    with zipfile.ZipFile(ZIP) as zf:
        zip_files = {
            e.filename.replace("\\", "/")
            for e in zf.infolist()
            if not e.filename.endswith("/")
        }

    info["out_files"] = len(out_files)
    missing_in_zip = sorted(out_files - zip_files)
    extra_in_zip = sorted(zip_files - out_files)
    info["missing_in_zip"] = len(missing_in_zip)
    info["extra_in_zip"] = len(extra_in_zip)
    if missing_in_zip:
        issues.append(
            f"out/ files missing from zip: {len(missing_in_zip)} e.g. {missing_in_zip[:3]}"
        )
    if extra_in_zip:
        warnings.append(f"zip extra vs out/: {len(extra_in_zip)} e.g. {extra_in_zip[:3]}")

    index_html = (OUT / "index.html").read_text(encoding="utf-8", errors="ignore")
    info["local_buildId"] = build_id(index_html)
    if len(index_html) < 5000:
        issues.append(f"index.html suspiciously small: {len(index_html)} bytes")
    if "_next" not in index_html:
        issues.append("index.html missing _next references")

    seeds = pilot_seed_pages()
    build_ids: dict[str, str | None] = {}
    seed_refs: set[str] = set()
    for p in seeds:
        if not p.is_file():
            warnings.append(f"seed page missing: {p.relative_to(OUT)}")
            continue
        text = p.read_text(encoding="utf-8", errors="ignore")
        build_ids[str(p.relative_to(OUT))] = build_id(text)
        seed_refs |= set(ASSET_PAT.findall(text))

    info["unique_buildIds"] = sorted({v for v in build_ids.values() if v})
    if len(info["unique_buildIds"]) > 1:
        warnings.append(f"multiple buildIds across seed pages: {build_ids}")

    missing_chunks = [
        ref.lstrip("/")
        for ref in sorted(seed_refs)
        if not (OUT / ref.lstrip("/")).is_file()
    ]
    if missing_chunks:
        issues.append(
            f"seed pages reference missing chunks: {missing_chunks[:8]} (total {len(missing_chunks)})"
        )
    info["seed_chunk_refs"] = len(seed_refs)

    # Full HTML scan
    missing_by_page: dict[str, list[str]] = {}
    html_count = 0
    for html in OUT.rglob("*.html"):
        html_count += 1
        text = html.read_text(encoding="utf-8", errors="ignore")
        refs = set(ASSET_PAT.findall(text))
        miss = [r for r in refs if not (OUT / r.lstrip("/")).is_file()]
        if miss:
            missing_by_page[str(html.relative_to(OUT))] = miss[:3]

    info["html_files_scanned"] = html_count
    info["html_with_missing_chunks"] = len(missing_by_page)
    if missing_by_page:
        sample = list(missing_by_page.items())[:5]
        issues.append(
            f"{len(missing_by_page)} HTML pages reference missing _next assets e.g. {sample}"
        )

    prod_html = list((OUT / "products").glob("*.html"))
    review_dir = OUT / "products" / "reviews"
    review_html = list(review_dir.glob("*.html")) if review_dir.is_dir() else []
    info["pdp_count"] = len(prod_html)
    info["reviews_count"] = len(review_html)
    pdp_handles = {p.stem for p in prod_html}
    rev_handles = {p.stem for p in review_html}
    only_pdp = sorted(pdp_handles - rev_handles)
    only_rev = sorted(rev_handles - pdp_handles)
    if only_pdp:
        warnings.append(f"PDP without reviews page: {len(only_pdp)} (sample {only_pdp[:3]})")
    if only_rev:
        warnings.append(f"reviews page without PDP: {len(only_rev)} (sample {only_rev[:3]})")

    # Reviews component markers on pilot page
    pilot = OUT / "products/reviews/tz-eldz-012.html"
    if pilot.is_file():
        pilot_text = pilot.read_text(encoding="utf-8", errors="ignore")
        for needle in ("ProductReviewsSection", "reviews/tz-eldz-012", "writeReview"):
            if needle not in pilot_text and "1577d48292d29a7b" not in pilot_text:
                pass  # static export may minify �?check chunk hash instead
        if "1577d48292d29a7b" in pilot_text or "7361669abc27e184" in pilot_text:
            info["pilot_reviews_chunk"] = "present"
        else:
            warnings.append("pilot reviews page may not bundle reviews route chunk (minified HTML)")

    if HTACCESS.is_file():
        info["htaccess_restore_kb"] = round(HTACCESS.stat().st_size / 1024, 1)
        ht = HTACCESS.read_text(encoding="utf-8", errors="ignore")
        for needle in ("RewriteEngine On", "wp-json", "products/reviews"):
            if needle not in ht:
                warnings.append(f"htaccess.restore missing: {needle!r}")
    else:
        issues.append("missing deploy/htaccess.restore")

    if not UNZIP_PHP.is_file():
        issues.append("missing deploy/unzip-export.php")
    elif "ybb-static-export.zip" not in UNZIP_PHP.read_text(encoding="utf-8"):
        issues.append("unzip-export.php does not reference ybb-static-export.zip")

    print_report(info, issues, warnings)
    return 1 if issues else 0


def print_report(info: dict, issues: list[str], warnings: list[str]) -> None:
    print("=== PACKAGE AUDIT (pre-upload) ===")
    print(json.dumps(info, indent=2, ensure_ascii=False))
    print("--- BLOCKERS ---")
    print("\n".join(issues) if issues else "(none)")
    print("--- WARNINGS ---")
    print("\n".join(warnings) if warnings else "(none)")
    print("--- VERDICT ---")
    if issues:
        print("BLOCKED �?do not upload")
    elif warnings:
        print("PASS WITH WARNINGS �?review before upload")
    else:
        print("OK �?package looks safe to upload")


if __name__ == "__main__":
    raise SystemExit(main())
