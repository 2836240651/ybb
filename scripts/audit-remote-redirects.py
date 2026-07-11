#!/usr/bin/env python3
"""Probe carp-ybb.com clean URLs derived from out/ — detect redirect loops."""

from __future__ import annotations

import json
import re
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "out"
REPORT = ROOT / "reports" / "remote-redirect-audit.json"
SITE = "https://carp-ybb.com"


def clean_urls_from_out() -> list[str]:
    urls: set[str] = {"/"}
    for html in OUT.rglob("*.html"):
        rel = html.relative_to(OUT).as_posix()
        if rel == "index.html":
            continue
        if rel == "404.html":
            urls.add("/404")
            continue
        path = "/" + rel.removesuffix(".html")
        urls.add(path)
    return sorted(urls)


def curl_head(url: str) -> dict:
    proc = subprocess.run(
        ["curl.exe", "-sI", "--max-redirs", "0", "-A", "ybb-redirect-audit/1.0", url],
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        timeout=30,
    )
    status = None
    location = None
    ctype = None
    for line in proc.stdout.splitlines():
        if line.upper().startswith("HTTP/"):
            m = re.search(r" (\d{3}) ", line)
            if m:
                status = int(m.group(1))
        elif line.lower().startswith("location:"):
            location = line.split(":", 1)[1].strip()
        elif line.lower().startswith("content-type:"):
            ctype = line.split(":", 1)[1].strip()
    return {"status": status, "location": location, "content_type": ctype}


def classify(path: str, resp: dict) -> str:
    status = resp.get("status")
    loc = resp.get("location") or ""
    if status == 200:
        return "ok"
    if status in (301, 302, 307, 308):
        loc_path = urlparse(loc).path if loc.startswith("http") else loc
        if loc.rstrip("/") == f"{SITE}{path}".rstrip("/"):
            return "loop_self"
        if loc_path.rstrip("/") == path.rstrip("/"):
            return "loop_self"
        # /cart -> /cart/ is normal Woo trailing-slash canonicalization
        if path == "/cart" and loc_path.rstrip("/") == "/cart":
            return "trailing_slash_ok"
        if status == 301 and loc_path.endswith("/") and loc_path.rstrip("/") == path:
            return "trailing_slash_ok"
        if ".html" in loc and loc.replace(".html", "") == f"{SITE}{path}":
            return "loop_self"
        return "redirect_other"
    if status == 403:
        return "forbidden"
    if status == 404:
        return "not_found"
    return f"http_{status}"


def main() -> int:
    paths = clean_urls_from_out()
    rows: list[dict] = []
    counts: dict[str, int] = {}

    print(f"[audit] probing {len(paths)} clean URLs on {SITE}")
    for i, path in enumerate(paths, 1):
        url = f"{SITE}{path}"
        resp = curl_head(url)
        kind = classify(path, resp)
        counts[kind] = counts.get(kind, 0) + 1
        row = {"path": path, "url": url, "kind": kind, **resp}
        rows.append(row)
        if kind in ("loop_self", "forbidden", "not_found"):
            print(f"  FAIL [{kind}] {path} -> {resp.get('status')} {resp.get('location') or ''}")
        if i % 25 == 0:
            print(f"  ... {i}/{len(paths)}")
        time.sleep(0.05)

    report = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "site": SITE,
        "total": len(paths),
        "counts": counts,
        "rows": rows,
        "failures": [r for r in rows if r["kind"] not in ("ok", "redirect_other", "trailing_slash_ok")],
    }
    REPORT.parent.mkdir(parents=True, exist_ok=True)
    REPORT.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    print(f"\n[audit] summary: {json.dumps(counts, ensure_ascii=False)}")
    print(f"[audit] report: {REPORT}")
    return 1 if report["failures"] else 0


if __name__ == "__main__":
    raise SystemExit(main())
