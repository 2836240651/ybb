#!/usr/bin/env python3
"""Build WooCommerce product reimport payload from 产品表单.xlsx (legacy CLI)."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from form_parser import DEFAULT_OUT, DEFAULT_XLSX, parse_workbook, write_csv, write_manifest, write_sku_mappings

ROOT = Path(__file__).resolve().parents[1]
LEGACY_OUT = ROOT / "deploy" / "wc-product-import.json"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--xlsx", type=Path, default=DEFAULT_XLSX)
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT)
    parser.add_argument("--legacy-json", type=Path, default=LEGACY_OUT)
    args = parser.parse_args()
    if not args.xlsx.exists():
        print(f"Excel not found: {args.xlsx}", file=sys.stderr)
        return 1

    rows, manifest = parse_workbook(args.xlsx, sku_mappings_dir=args.out / "sku-mappings")
    write_manifest(manifest, args.out / "manifest.json")
    write_csv(rows, args.out / "woocommerce-products.csv")
    write_sku_mappings(manifest, args.out / "sku-mappings")

    legacy = {
        "source": manifest["source"],
        "generatedAt": manifest["generatedAt"],
        "mode": "replace",
        "attribute": manifest.get("attribute", {"name": "Spec", "slug": "spec", "taxonomy": "pa_spec"}),
        "defaultPrice": manifest.get("defaultPrice", "1.99"),
        "products": [
            {
                "sku": r.variant_sku,
                "name": r.name,
                "type": "simple",
                "regularPrice": r.price,
                "categorySlugs": r.category_slugs,
                "parentSku": r.parent_sku,
                "spec": r.spec,
            }
            for r in rows
        ],
        "stats": manifest.get("stats", {}),
    }
    args.legacy_json.parent.mkdir(parents=True, exist_ok=True)
    args.legacy_json.write_text(json.dumps(legacy, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {args.out / 'manifest.json'}")
    print(f"Wrote {args.legacy_json}")
    print(json.dumps(manifest["stats"], ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

