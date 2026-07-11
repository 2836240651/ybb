#!/usr/bin/env python3
import json
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
SITE = "https://carp-ybb.com"
URL = f"{SITE}/wp-admin/admin.php?page=ybb-site-manager&tab=reviews-import"
OUT = ROOT / "reports" / "reviews-import-cdp-debug.txt"

with sync_playwright() as p:
    browser = p.chromium.connect_over_cdp("http://127.0.0.1:9224")
    context = browser.contexts[0]
    page = context.pages[0] if context.pages else context.new_page()
    lines = [f"start url={page.url}", f"title={page.title()}"]
    page.goto(URL, wait_until="domcontentloaded", timeout=120000)
    page.wait_for_timeout(2000)
    body = page.locator("body").inner_text()
    html = page.content()
    lines += [
        f"import url={page.url}",
        f"title2={page.title()}",
        f"body_len={len(body)}",
        f"has_reviews_tab={'评价导入' in body}",
        f"has_import_tab={'reviews-import' in html}",
        f"has_ybb_sm={'ybb-site-manager' in html}",
        f"has_import_file={page.locator('input[type=file][name=import_file]').count()}",
        f"has_preview={page.locator('input[type=submit][value=预览]').count()}",
        f"has_login={page.locator('#loginform').count()}",
        f"body_preview={body[:1200].replace(chr(10), ' ')}",
    ]
    sm = page.locator(".wrap, #wpbody-content").first
    if sm.count():
        lines.append(f"wrap_preview={sm.inner_text()[:1500].replace(chr(10), ' ')}")
OUT.write_text("\n".join(lines), encoding="utf-8")
print(OUT)
