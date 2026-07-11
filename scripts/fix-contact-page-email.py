#!/usr/bin/env python3
"""Update YBB Site Manager contact sales email on production via WP admin UI."""
from __future__ import annotations

import json
import re
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
SECRETS = json.loads((ROOT / "secrets.local.json").read_text(encoding="utf-8"))
SALES_EMAIL = "ybb.sales@yoto.work"


def pass_sgcaptcha(page, site_url: str) -> None:
    page.goto(site_url, wait_until="domcontentloaded")
    for _ in range(40):
        if "sgcaptcha" not in page.url:
            return
        page.wait_for_timeout(1000)
    raise RuntimeError(f"SiteGround captcha not cleared: {page.url}")


def maybe_login(page, wp: dict) -> None:
    if "wp-login.php" not in page.url:
        return
    page.fill("#user_login", wp["email"])
    page.fill("#user_pass", wp["password"])
    captcha = page.locator("#jetpack_protect_answer")
    if captcha.count():
        label = page.locator('label[for="jetpack_protect_answer"]').inner_text()
        nums = [int(n) for n in re.findall(r"\d+", label)]
        if len(nums) >= 2:
            captcha.fill(str(nums[0] + nums[1]))
    page.click("#wp-submit")
    page.wait_for_load_state("domcontentloaded")
    page.wait_for_timeout(1500)


def main() -> int:
    wp = SECRETS["wordpress"]
    site = wp["siteUrl"].rstrip("/")

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        pass_sgcaptcha(page, site)
        page.goto(f"{wp['siteUrl']}/wp-login.php", wait_until="domcontentloaded")
        maybe_login(page, wp)
        page.goto(
            f"{wp['adminUrl']}/admin.php?page=ybb-site-manager&tab=contact",
            wait_until="domcontentloaded",
        )
        maybe_login(page, wp)
        email_input = page.locator("#ybb_sm_contact_sales_email")
        email_input.wait_for(state="visible", timeout=60000)
        email_input.fill(SALES_EMAIL)
        page.locator('input[type="submit"][name="submit"]').first.click()
        page.wait_for_load_state("domcontentloaded")
        page.wait_for_timeout(2000)
        after = page.evaluate(
            """async (url) => {
              const res = await fetch(url, { headers: { Accept: 'application/json' }, cache: 'no-store' });
              return { status: res.status, body: await res.json() };
            }""",
            f"{site}/index.php?rest_route=/ybb/v1/site-manager/contact",
        )
        browser.close()

    print("salesEmail:", after["body"].get("salesEmail"))
    return 0 if after["body"].get("salesEmail") == SALES_EMAIL else 1


if __name__ == "__main__":
    raise SystemExit(main())
