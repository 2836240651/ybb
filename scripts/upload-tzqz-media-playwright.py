#!/usr/bin/env python3
from __future__ import annotations

import json
import time
from pathlib import Path

from playwright.sync_api import TimeoutError as PlaywrightTimeoutError
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
SECRETS_PATH = ROOT / "secrets.local.json"
UPLOAD_DIR = Path(r"C:\Users\Administrator\Pictures\tzqz-upload-jpg")
REPORT_PATH = ROOT / "deploy" / "product-import" / "tzqz-upload-report.json"

SAMPLES = [
    "tz-qz-001-56g",
    "tz-qz-004-42g",
    "tz-qz-010-56g",
    "tz-qz-021-14g",
    "tz-qz-026-71g",
]


def load_wp_secrets() -> dict:
    data = json.loads(SECRETS_PATH.read_text(encoding="utf-8"))
    wp = data.get("wordpress", {})
    required = ["adminUrl", "email", "password"]
    missing = [k for k in required if not wp.get(k)]
    if missing:
        raise RuntimeError(f"missing wordpress keys in secrets.local.json: {missing}")
    return wp


def collect_files() -> list[str]:
    files = sorted(str(p) for p in UPLOAD_DIR.glob("*.jpg"))
    if not files:
        raise RuntimeError(f"no files found in {UPLOAD_DIR}")
    return files


def main() -> int:
    wp = load_wp_secrets()
    files = collect_files()

    report: dict = {
        "startedAt": time.strftime("%Y-%m-%dT%H:%M:%S"),
        "fileCount": len(files),
        "uploaded": False,
        "samplesFound": {},
        "mediaUrls": [],
    }

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()

        admin_url = wp["adminUrl"].rstrip("/")
        page.goto(f"{admin_url}/upload.php?mode=list", wait_until="domcontentloaded")

        if "wp-login.php" in page.url:
            page.fill("#user_login", wp["email"])
            page.fill("#user_pass", wp["password"])
            page.click("#wp-submit")
            page.wait_for_load_state("domcontentloaded")

        page.goto(f"{admin_url}/media-new.php", wait_until="domcontentloaded")

        file_input = page.locator("input[type='file']").first
        file_input.set_input_files(files)

        # Wait for upload queue to settle.
        try:
            page.wait_for_selector(".uploading, .media-upload-form .error", timeout=5000)
        except PlaywrightTimeoutError:
            pass

        page.wait_for_timeout(8000)
        for _ in range(20):
            uploading = page.locator(".uploading").count()
            if uploading == 0:
                break
            page.wait_for_timeout(2000)

        page.goto(f"{admin_url}/upload.php?mode=list", wait_until="domcontentloaded")

        for key in SAMPLES:
            search = page.locator("#media-search-input")
            if search.count() == 0:
                report["samplesFound"][key] = False
                continue
            search.fill(key)
            page.keyboard.press("Enter")
            page.wait_for_load_state("domcontentloaded")
            found = page.locator(f"a:has-text('{key}')").count() > 0
            report["samplesFound"][key] = found
            if found:
                page.locator(f"a:has-text('{key}')").first.click()
                page.wait_for_load_state("domcontentloaded")
                url_input = page.locator("input#attachment_url")
                if url_input.count() > 0:
                    report["mediaUrls"].append(url_input.input_value())
                page.go_back(wait_until="domcontentloaded")

        report["uploaded"] = any(report["samplesFound"].values())

        context.close()
        browser.close()

    REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
    REPORT_PATH.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"[upload-tzqz-media-playwright] files={len(files)} uploaded={report['uploaded']}")
    print(f"[upload-tzqz-media-playwright] report={REPORT_PATH}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
