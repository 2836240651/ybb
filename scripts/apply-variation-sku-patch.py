#!/usr/bin/env python3
"""Upload variation SKU patch + PHP trigger on carp-ybb.com."""

from __future__ import annotations

import json
import subprocess
import sys
import time
from pathlib import Path
from urllib.parse import urljoin

from playwright.sync_api import sync_playwright

sys.path.insert(0, str(Path(__file__).resolve().parent))
from deploy_ftps import _upload_file, connect_ftps, load_secrets

ROOT = Path(__file__).resolve().parents[1]
PATCH_JSON = ROOT / "deploy" / "variation-sku-patch.json"
PATCH_PHP = ROOT / "deploy" / "patch-variation-skus.php"
MIGRATE_KEY = "ybb-migrate-20260624"
SITE = "https://carp-ybb.com"
SAMPLE_SKUS = ["TZ-ZJ-023", "TZ-XP-053", "TZ-XP-007"]


def log(msg: str) -> None:
    print(msg, flush=True)


def invoke_patch(site: str, dry_run: bool) -> dict:
    suffix = "&dry_run=1" if dry_run else ""
    url = f"{site.rstrip('/')}/patch-variation-skus.php?key={MIGRATE_KEY}{suffix}&nocache=1"
    log(f"[apply-patch] GET {url}")
    proc = subprocess.run(
        ["curl.exe", "-sS", url],
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        timeout=120,
    )
    if proc.returncode != 0:
        raise RuntimeError(f"curl failed: {proc.stderr}")
    raw = proc.stdout.strip()
    if not raw.startswith("{"):
        raise RuntimeError(f"unexpected response: {raw[:300]}")
    return json.loads(raw)


def verify_samples(page, site: str, patch_payload: dict) -> list[str]:
    issues: list[str] = []
    by_parent = {p["parentSku"]: p for p in patch_payload.get("patches") or []}
    for parent_sku in SAMPLE_SKUS:
        matches = [p for p in patch_payload.get("patches") or [] if p.get("parentSku") == parent_sku]
        if not matches:
            continue
        parent_wc_id = int(matches[0].get("parentWcId") or 0)
        page.goto(
            urljoin(site, f"/index.php?rest_route=/wc/store/v1/products/{parent_wc_id}"),
            wait_until="domcontentloaded",
        )
        page.wait_for_timeout(800)
        try:
            parent = json.loads(page.locator("body").inner_text().strip())
        except json.JSONDecodeError as exc:
            issues.append(f"{parent_sku}: parent fetch failed {exc}")
            continue
        for patch in matches:
            vid = int(patch["variationWcId"])
            target = patch["targetSku"]
            page.goto(
                urljoin(site, f"/index.php?rest_route=/wc/store/v1/products/{vid}"),
                wait_until="domcontentloaded",
            )
            page.wait_for_timeout(600)
            try:
                detail = json.loads(page.locator("body").inner_text().strip())
            except json.JSONDecodeError as exc:
                issues.append(f"{parent_sku} vid={vid}: {exc}")
                continue
            live_sku = str(detail.get("sku") or "")
            if live_sku != target:
                issues.append(f"{parent_sku} vid={vid}: live={live_sku} expected={target}")
            else:
                log(f"[verify] OK {parent_sku} vid={vid} sku={live_sku}")
    return issues


def main() -> int:
    if not PATCH_JSON.is_file():
        log(f"Missing {PATCH_JSON}; run build-variation-sku-patch.py first")
        return 1

    patch_payload = json.loads(PATCH_JSON.read_text(encoding="utf-8"))
    log(f"[apply-patch] patches={patch_payload.get('patchCount')}")

    ftp = load_secrets()["ftp"]
    remote = ftp["remoteRoot"].rstrip("/")
    client = connect_ftps(ftp)
    try:
        _upload_file(client, remote, PATCH_JSON, "variation-sku-patch.json")
        _upload_file(client, remote, PATCH_PHP, "patch-variation-skus.php")
    finally:
        try:
            client.quit()
        except Exception:
            client.close()

    dry = invoke_patch(SITE, dry_run=True)
    log(f"[apply-patch] dry_run updated={dry.get('updated')} skipped={dry.get('skipped')} errors={len(dry.get('errors') or [])}")
    if dry.get("errors"):
        log(json.dumps(dry["errors"], ensure_ascii=False, indent=2))
        return 1

    applied = invoke_patch(SITE, dry_run=False)
    log(
        f"[apply-patch] applied updated={applied.get('updated')} "
        f"skipped={applied.get('skipped')} errors={len(applied.get('errors') or [])}"
    )
    if applied.get("errors"):
        log(json.dumps(applied["errors"], ensure_ascii=False, indent=2))
        return 1

    # cleanup server temp files
    client = connect_ftps(ftp)
    try:
        for name in ("variation-sku-patch.json", "patch-variation-skus.php"):
            try:
                client.delete(f"{remote}/{name}")
            except Exception:
                pass
    finally:
        try:
            client.quit()
        except Exception:
            client.close()

    with sync_playwright() as p:
        page = p.chromium.launch(headless=True).new_page()
        page.goto(SITE, wait_until="domcontentloaded")
        for _ in range(60):
            if "sgcaptcha" not in page.url:
                break
            page.wait_for_timeout(1000)
        issues = verify_samples(page, SITE, patch_payload)
        if issues:
            for item in issues:
                log(f"[verify] FAIL {item}")
            return 1

    log("[apply-patch] OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
