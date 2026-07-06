#!/usr/bin/env python3
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
report_path = ROOT / "reports" / "product-variant-sku-full-audit.json"

if report_path.exists():
    r = json.loads(report_path.read_text(encoding="utf-8"))
    print("=== LIVE REPORT (product-variant-sku-full-audit.json) ===")
    print(
        f"parentSkuPass={r.get('parentSkuPass')} parentSkuFail={r.get('parentSkuFail')}"
    )
    print(
        f"variationSetsPass={r.get('variationSetsPass')} "
        f"variationSetsFail={r.get('variationSetsFail')}"
    )
    print(f"failureCount={r.get('failureCount')}")
    print(f"variationSkuCount={r.get('variationSkuCount')}")
    failures = r.get("failures") or []
    by_scope: dict[str, int] = {}
    for f in failures:
        s = str(f.get("scope") or "unknown")
        by_scope[s] = by_scope.get(s, 0) + 1
    print("\n=== FAILURES BY SCOPE ===")
    for k, v in sorted(by_scope.items(), key=lambda x: -x[1]):
        print(f"  {k}: {v}")
    print("\n=== FIRST 20 FAILURES ===")
    for f in failures[:20]:
        issues = "; ".join(f.get("issues") or [])
        print(
            f"  [{f.get('scope')}] {f.get('parentSku')} "
            f"({f.get('handle')}): {issues}"
        )
    sys.exit(0 if not failures else 1)

print("ERROR: product-variant-sku-full-audit.json not found")
print(f"  expected: {report_path}")
log = ROOT / "reports" / "product-variant-sku-full-audit.log"
if log.exists():
    lines = log.read_text(encoding="utf-8").strip().splitlines()
    print(f"\nLog tail ({len(lines)} lines):")
    for line in lines[-8:]:
        print(f"  {line}")
sys.exit(2)
