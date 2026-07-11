#!/usr/bin/env python3
"""Debug one preview submit on YBB 评价导入."""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from upload_reviews_import_playwright import (  # type: ignore
    REVIEWS_IMPORT_URL,
    connect_page,
    dashboard_url,
    ensure_playwright,
    ensure_single_page,
    goto_reviews_import,
    load_secrets,
    login_wp,
    DEFAULT_PROFILE,
)

XLSX = Path(__file__).resolve().parents[2] / "reports/product-reviews-import/all-products-reviews-import-batch1-20260710.xlsx"
OUT = Path(__file__).resolve().parents[2] / "reports/product-reviews-import/_debug-preview-panel.txt"


def main() -> int:
    secrets = load_secrets()
    wp = secrets.get("wordpress") or {}
    with ensure_playwright()() as p:
        handle, page, is_cdp = connect_page(
            p, headless=False, use_cdp=False, profile=DEFAULT_PROFILE
        )
        login_wp(page, wp)
        goto_reviews_import(page, wp)
        form = page.locator('.ybb-pr-import-admin form[enctype="multipart/form-data"]').first
        form.locator('input[name="import_file"]').set_input_files(str(XLSX))
        page.wait_for_timeout(500)
        with page.expect_navigation(wait_until="networkidle", timeout=180000):
            form.locator('input[type="submit"]').click(force=True)
        page.wait_for_timeout(2000)
        panel = page.locator(".ybb-pr-import-admin").first.inner_text()
        notices = page.locator(".ybb-pr-import-admin .notice").all_inner_texts()
        OUT.write_text(
            f"url={page.url}\n\nnotices={notices}\n\npanel=\n{panel}",
            encoding="utf-8",
        )
        print(OUT)
        if not is_cdp:
            handle.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
