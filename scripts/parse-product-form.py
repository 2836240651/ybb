#!/usr/bin/env python3
"""Parse product form xlsx."""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from form_parser import (
    DEFAULT_OUT,
    DEFAULT_XLSX,
    parse_workbook,
    write_csv,
    write_manifest,
    write_product_i18n,
    write_sku_mappings,
    write_variant_redirects,
    write_wc_catalog,
)

ROOT = Path(__file__).resolve().parents[1]


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--xlsx", type=Path, default=DEFAULT_XLSX)
    p.add_argument("--out", type=Path, default=DEFAULT_OUT)
    args = p.parse_args()
    if not args.xlsx.exists():
        print(f"Excel not found: {args.xlsx}", file=sys.stderr)
        return 1

    rows, manifest = parse_workbook(args.xlsx, sku_mappings_dir=args.out / "sku-mappings")
    write_manifest(manifest, args.out / "manifest.json")
    write_csv(rows, args.out / "woocommerce-products.csv")
    write_sku_mappings(manifest, args.out / "sku-mappings")
    catalog_products = write_wc_catalog(rows, args.out / "wc-catalog.json")
    write_variant_redirects(catalog_products, args.out / "variant-redirects.json")
    write_product_i18n(manifest, ROOT / "lib" / "data" / "product-i18n-by-sku.json")

    print(f"Wrote {args.out / 'manifest.json'}")
    print(f"Wrote {args.out / 'wc-catalog.json'}")
    print(json.dumps(manifest["stats"], ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
