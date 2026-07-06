#!/usr/bin/env python3
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
audit = json.loads((ROOT / "reports/product-variant-sku-full-audit.json").read_text(encoding="utf-8"))
orig26 = {
    "tz-zj-023", "tz-pjsl-072", "tz-xp-001", "tz-xp-002", "tz-xp-003", "tz-xp-004", "tz-xp-005",
    "tz-xp-007", "tz-xp-014", "tz-xp-020", "tz-xp-021", "tz-xp-043", "tz-xp-044", "tz-xp-045",
    "tz-xp-048", "tz-xp-049", "tz-xp-050", "tz-xp-051", "tz-xp-052", "tz-xp-053",
    "tz-el-094", "tz-el-095", "tz-el-096", "tz-el-097", "tz-el-098", "tz-el-099",
}
rows = [r for r in audit.get("variationRows") or [] if r.get("handle") in orig26]
fail = [r for r in rows if not r.get("ok")]
print(f"orig26 pass={len(rows)-len(fail)}/{len(rows)} fail={len(fail)}")
for r in fail:
    print(r["parentSku"], r.get("issues"))
