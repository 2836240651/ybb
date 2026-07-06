#!/usr/bin/env python3
"""Build Woo variation SKU patch manifest from full audit failures."""

from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from sku_normalize import canonical_variant_sku

ROOT = Path(__file__).resolve().parents[1]
AUDIT_PATH = ROOT / "reports" / "product-variant-sku-full-audit.json"
PRODUCTS_PATH = ROOT / "lib" / "data" / "products.json"
PATCH_PATH = ROOT / "deploy" / "variation-sku-patch.json"
PLAN_PATH = ROOT / "reports" / "variation-sku-patch-plan.md"


def woo_sku_by_wc_id(row: dict) -> dict[int, str]:
    out: dict[int, str] = {}
    wc_ids = row.get("wooWcIds") or row.get("catalogWcIds") or []
    skus = row.get("wooSkus") or []
    for wc_id, sku in zip(wc_ids, skus):
        out[int(wc_id)] = str(sku)
    return out


def main() -> int:
    audit = json.loads(AUDIT_PATH.read_text(encoding="utf-8"))
    products = json.loads(PRODUCTS_PATH.read_text(encoding="utf-8"))
    by_handle = {str(p.get("handle") or ""): p for p in products}

    failed_rows = [r for r in audit.get("variationRows") or [] if not r.get("ok")]
    patches: list[dict] = []
    lines = [
        "# Variation SKU patch plan",
        "",
        f"Generated: {datetime.now(timezone.utc).isoformat()}",
        f"Failed product sets: {len(failed_rows)}",
        "",
    ]

    for row in failed_rows:
        handle = str(row.get("handle") or "")
        product = by_handle.get(handle)
        if not product:
            lines.append(f"- **MISSING** handle={handle}")
            continue

        parent_sku = str(product.get("sku") or row.get("parentSku") or "")
        parent_wc_id = int(product.get("wcId") or 0)
        woo_by_id = woo_sku_by_wc_id(row)
        lines.append(f"## {parent_sku} (`{handle}`)")

        for variant in product.get("variants") or []:
            wc_id = int(variant.get("wcId") or 0)
            if not wc_id:
                continue
            spec = str(variant.get("spec") or "")
            target = canonical_variant_sku(parent_sku, spec)
            current_catalog = str(variant.get("sku") or "")
            current_woo = woo_by_id.get(wc_id, "")
            if target == current_woo and target == current_catalog:
                continue
            patches.append(
                {
                    "handle": handle,
                    "parentSku": parent_sku,
                    "parentWcId": parent_wc_id,
                    "variationWcId": wc_id,
                    "spec": spec,
                    "currentCatalogSku": current_catalog,
                    "currentWooSku": current_woo,
                    "targetSku": target,
                }
            )
            lines.append(
                f"- wcId `{wc_id}` spec `{spec}`: "
                f"woo `{current_woo or '(empty)'}` / catalog `{current_catalog}` �?**`{target}`**"
            )
        lines.append("")

    payload = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "sourceAudit": str(AUDIT_PATH.relative_to(ROOT)).replace("\\", "/"),
        "parentCount": len(failed_rows),
        "patchCount": len(patches),
        "patches": patches,
    }
    PATCH_PATH.parent.mkdir(parents=True, exist_ok=True)
    PATCH_PATH.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    PLAN_PATH.write_text("\n".join(lines) + "\n", encoding="utf-8")

    print(f"[build-variation-sku-patch] parents={len(failed_rows)} patches={len(patches)}")
    print(f"[build-variation-sku-patch] wrote {PATCH_PATH}")
    print(f"[build-variation-sku-patch] wrote {PLAN_PATH}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
