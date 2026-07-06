#!/usr/bin/env python3
from __future__ import annotations

import csv
import json
from pathlib import Path

from openpyxl import load_workbook

ROOT = Path(__file__).resolve().parents[1]
MANIFEST_PATH = ROOT / "deploy" / "product-import" / "manifest.json"
CATALOG_PATH = ROOT / "deploy" / "product-import" / "wc-catalog.json"
WORKBOOK_PATH = Path.home() / "Desktop" / "产品表单.xlsx"
OUT_DIR = ROOT / "deploy" / "product-import" / "tz-qz-image-sources"
CHECKLIST_PATH = ROOT / "deploy" / "product-import" / "tz-qz-image-checklist.csv"


def parent_handle(parent_sku: str) -> str:
    return parent_sku.strip().lower().replace(" ", "-")


def variant_handle(variant_sku: str) -> str:
    text = variant_sku.strip().lower()
    chars: list[str] = []
    prev_dash = False
    for ch in text:
        if ch.isalnum():
            chars.append(ch)
            prev_dash = False
        else:
            if not prev_dash:
                chars.append("-")
                prev_dash = True
    return "".join(chars).strip("-")


def main() -> int:
    if not WORKBOOK_PATH.exists():
        raise SystemExit(f"Workbook not found: {WORKBOOK_PATH}")

    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    catalog = json.loads(CATALOG_PATH.read_text(encoding="utf-8"))
    wb = load_workbook(WORKBOOK_PATH)

    # First image row per TZ-QZ parent from manifest image refs.
    parent_row_map: dict[str, tuple[str, int]] = {}
    for ref in manifest.get("imageRefs", []):
        parent_sku = str(ref.get("parentSku") or "").strip()
        if not parent_sku.startswith("TZ-QZ-"):
            continue
        sheet = str(ref.get("sheet") or "").strip()
        row = int(ref.get("row") or 0)
        if parent_sku not in parent_row_map:
            parent_row_map[parent_sku] = (sheet, row)

    # Build row->image index per sheet from workbook embedded images.
    sheet_row_images: dict[str, dict[int, object]] = {}
    for ws in wb.worksheets:
        row_map: dict[int, object] = {}
        for image in getattr(ws, "_images", []):
            anchor = getattr(image, "anchor", None)
            marker = getattr(anchor, "_from", None)
            if marker is None:
                continue
            excel_row = int(marker.row) + 1
            row_map.setdefault(excel_row, image)
        sheet_row_images[ws.title] = row_map

    OUT_DIR.mkdir(parents=True, exist_ok=True)

    rows: list[dict[str, str]] = []
    for product in catalog.get("products", []):
        parent_sku = str(product.get("parentSku") or "").strip()
        if not parent_sku.startswith("TZ-QZ-"):
            continue

        source_file = ""
        status = "missing-source"
        sheet, row = parent_row_map.get(parent_sku, ("", 0))
        image_obj = sheet_row_images.get(sheet, {}).get(row)
        if image_obj is not None:
            ext = ".png"
            raw_path = getattr(image_obj, "path", "")
            if isinstance(raw_path, str) and raw_path.lower().endswith(".jpeg"):
                ext = ".jpg"
            elif isinstance(raw_path, str) and raw_path.lower().endswith(".jpg"):
                ext = ".jpg"
            elif isinstance(raw_path, str) and raw_path.lower().endswith(".gif"):
                ext = ".gif"
            source_path = OUT_DIR / f"{parent_handle(parent_sku)}{ext}"
            source_path.write_bytes(image_obj._data())
            source_file = str(source_path)
            status = "ok"

        for variation in product.get("variations", []):
            sku = str(variation.get("sku") or "").strip()
            if not sku:
                continue
            rows.append(
                {
                    "parent_sku": parent_sku,
                    "variant_sku": sku,
                    "variant_handle": variant_handle(sku),
                    "sheet": sheet,
                    "row": str(row),
                    "source_file": source_file,
                    "status": status,
                }
            )

    with CHECKLIST_PATH.open("w", encoding="utf-8", newline="") as fh:
        writer = csv.DictWriter(
            fh,
            fieldnames=[
                "parent_sku",
                "variant_sku",
                "variant_handle",
                "sheet",
                "row",
                "source_file",
                "status",
            ],
        )
        writer.writeheader()
        writer.writerows(rows)

    ok_count = sum(1 for r in rows if r["status"] == "ok")
    print(f"[extract-tz-qz-images] wrote {CHECKLIST_PATH}")
    print(f"[extract-tz-qz-images] rows={len(rows)} ok={ok_count} missing={len(rows)-ok_count}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
