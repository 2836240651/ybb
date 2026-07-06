#!/usr/bin/env python3
"""Probe contact form mail chain on production (browser + REST status)."""
from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlencode

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
SECRETS = json.loads((ROOT / "secrets.local.json").read_text(encoding="utf-8"))
REPORT = ROOT / "reports" / "contact-mail-probe.json"


def pass_sgcaptcha(page, site_url: str) -> None:
    page.goto(site_url, wait_until="domcontentloaded")
    for _ in range(40):
        if "sgcaptcha" not in page.url:
            return
        page.wait_for_timeout(1000)
    raise RuntimeError(f"SiteGround captcha not cleared: {page.url}")


def fetch_mail_status(page, site: str) -> dict:
    cache_bust = int(datetime.now(timezone.utc).timestamp())
    result = page.evaluate(
        """async ({ url }) => {
          const res = await fetch(url, {
            headers: { Accept: 'application/json', 'Cache-Control': 'no-cache' },
            cache: 'no-store',
          });
          return { status: res.status, body: await res.json() };
        }""",
        {"url": f"{site}/index.php?rest_route=/ybb/v1/contact-mail-status&_={cache_bust}"},
    )
    return result


def submit_contact(page, site: str, tag: str) -> dict:
    payload = {
        "name": f"Probe {tag}",
        "email": "probe-contact@example.invalid",
        "company": f"ProbeCo-{tag}",
        "subject": "other",
        "message": f"Automated contact mail probe at {tag}. Please ignore.",
        "locale": "en",
        "website": "",
    }
    return page.evaluate(
        """async ({ url, payload }) => {
          const res = await fetch(url, {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify(payload),
          });
          let body = null;
          try { body = await res.json(); } catch { body = await res.text(); }
          return { status: res.status, body };
        }""",
        {
            "url": f"{site}/index.php?{urlencode({'rest_route': '/ybb/v1/contact-inquiry'})}",
            "payload": payload,
        },
    )


def main() -> int:
    wp = SECRETS["wordpress"]
    site = wp["siteUrl"].rstrip("/")
    tag = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
    capture: dict = {"at": datetime.now(timezone.utc).isoformat(), "tag": tag}

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        pass_sgcaptcha(page, site)
        capture["before"] = fetch_mail_status(page, site)
        capture["submit"] = submit_contact(page, site, tag)
        page.wait_for_timeout(2000)
        capture["after"] = fetch_mail_status(page, site)
        browser.close()

    before = capture["before"]["body"].get("lastAttempts", [])
    after = capture["after"]["body"].get("lastAttempts", [])
    newest = after[0] if after else {}
    capture["analysis"] = {
        "submitOk": capture["submit"]["status"] == 200,
        "newestLog": newest,
        "recipientConfigured": capture["after"]["body"].get("recipientEmail"),
        "contactFrom": capture["after"]["body"].get("contactFrom"),
        "transport": capture["after"]["body"].get("transport"),
        "logGrew": len(after) > len(before) or (after and after != before),
    }

    REPORT.parent.mkdir(parents=True, exist_ok=True)
    REPORT.write_text(json.dumps(capture, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {REPORT}")
    print("submit:", capture["submit"]["status"], capture["submit"].get("body"))
    print("newest log:", json.dumps(newest, ensure_ascii=False))
    return 0 if capture["analysis"]["submitOk"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
