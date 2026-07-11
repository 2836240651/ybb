#!/usr/bin/env python3
"""Browser audit: pass SG captcha, login, capture wp-admin result."""
from __future__ import annotations

import json
import re
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SECRETS = ROOT / "secrets.local.json"
SITE = "https://carp-ybb.com"
OUT = ROOT / "reports" / "wp-admin-browser-audit.json"


def pass_captcha(page, max_sec: int = 120) -> None:
    page.goto(SITE + "/", wait_until="domcontentloaded", timeout=120000)
    for i in range(max_sec):
        url = page.url
        try:
            text = page.locator("body").inner_text(timeout=2000)
        except Exception:
            text = ""
        blocked = (
            "sgcaptcha" in url
            or "Checking the site connection security" in text
            or "requires cookies to be enabled" in text
        )
        if not blocked and "carp-ybb.com" in url:
            return
        page.wait_for_timeout(1000)
    raise RuntimeError(f"captcha not cleared after {max_sec}s url={page.url}")


def snapshot_step(page, label: str) -> dict:
    try:
        text = page.locator("body").inner_text(timeout=5000)
    except Exception:
        text = ""
    html = page.content()
    return {
        "label": label,
        "url": page.url,
        "title": page.title(),
        "body_len": len(html),
        "text_len": len(text),
        "text_preview": text[:300].replace("\n", " "),
        "has_wpadminbar": "wp-admin-bar" in html,
        "has_loginform": "loginform" in html or "user_login" in html,
        "has_fatal": "critical error" in text.lower() or "fatal error" in text.lower(),
        "captcha": "sgcaptcha" in page.url or "Checking the site connection security" in text,
    }


def main() -> int:
    if not SECRETS.is_file():
        print("missing secrets", file=sys.stderr)
        return 1
    wp = json.loads(SECRETS.read_text(encoding="utf-8")).get("wordpress") or {}
    email = wp.get("email", "")
    password = wp.get("password", "")
    if not email or not password:
        print("missing wp creds", file=sys.stderr)
        return 1

    from playwright.sync_api import sync_playwright

    report: dict = {"steps": [], "conclusion": []}

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        context = browser.new_context()
        page = context.new_page()

        try:
            pass_captcha(page)
            report["steps"].append(snapshot_step(page, "after homepage captcha"))

            page.goto(SITE + "/wp-login.php", wait_until="domcontentloaded", timeout=120000)
            report["steps"].append(snapshot_step(page, "wp-login loaded"))

            if page.locator("#loginform").count():
                page.fill("#user_login", email)
                page.fill("#user_pass", password)
                page.click("#wp-submit")
                page.wait_for_load_state("domcontentloaded", timeout=120000)
            report["steps"].append(snapshot_step(page, "after login submit"))

            for target, label in [
                (SITE + "/wp-admin/index.php", "wp-admin index"),
                (SITE + "/wp-admin/index.php?sg_auto=1", "sg_auto"),
                (
                    SITE + "/wp-admin/admin.php?page=ybb-site-manager",
                    "ybb site manager",
                ),
            ]:
                page.goto(target, wait_until="domcontentloaded", timeout=120000)
                page.wait_for_timeout(2000)
                report["steps"].append(snapshot_step(page, label))

        finally:
            shot = ROOT / "reports" / "wp-admin-browser-audit.png"
            shot.parent.mkdir(parents=True, exist_ok=True)
            page.screenshot(path=str(shot), full_page=True)
            report["screenshot"] = str(shot)
            browser.close()

    # conclusions
    after_login = report["steps"][2] if len(report["steps"]) > 2 else {}
    admin_step = next((s for s in report["steps"] if s["label"] == "wp-admin index"), {})

    if admin_step.get("captcha"):
        report["conclusion"].append("BLOCKER: SG-Captcha still active in real browser after homepage pass")
    elif admin_step.get("has_loginform"):
        report["conclusion"].append("AUTH: login did not stick (cookies/session) — back at login form")
    elif admin_step.get("has_fatal"):
        report["conclusion"].append("BLOCKER: PHP fatal/critical error in admin")
    elif admin_step.get("has_wpadminbar"):
        report["conclusion"].append("OK: WordPress admin dashboard loaded")
    elif admin_step.get("text_len", 0) < 50:
        report["conclusion"].append("BLOCKER: near-empty body — likely captcha meta-refresh or headless redirect to blank static page")
    else:
        report["conclusion"].append(f"UNKNOWN: title={admin_step.get('title')} text_len={admin_step.get('text_len')}")

    OUT.write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")
    print(json.dumps(report, indent=2, ensure_ascii=False))
    print(f"screenshot: {report.get('screenshot')}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
