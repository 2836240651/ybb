#!/usr/bin/env python3
"""Configure contact inquiry recipient + Woo email sender on production WP."""
from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlencode

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
SECRETS = json.loads((ROOT / "secrets.local.json").read_text(encoding="utf-8"))
REPORT = ROOT / "reports" / "contact-mail-configure.json"

SALES_EMAIL = "carpybb@gmail.com"
FROM_EMAIL = "noreply@carp-ybb.com"
FROM_NAME = "YBB"
OPT = "ybb_site_manager_settings"
CONTACT_OPT = "ybb_contact_settings"


def pass_sgcaptcha(page, wp: dict) -> None:
    page.goto(wp["siteUrl"], wait_until="domcontentloaded")
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


def login(page, wp: dict) -> None:
    pass_sgcaptcha(page, wp)
    page.goto(f"{wp['siteUrl']}/wp-login.php", wait_until="domcontentloaded")
    maybe_login(page, wp)
    if "wp-login.php" in page.url:
        raise RuntimeError("Login failed")


def fetch_json(page, path: str) -> dict:
    return page.evaluate(
        """async (url) => {
          const res = await fetch(url, { headers: { Accept: 'application/json' } });
          return { status: res.status, body: await res.json() };
        }""",
        path,
    )


def post_options(context, wp: dict, page, pairs: list[tuple[str, str]]) -> int:
    nonce = page.locator('input[name="_wpnonce"]').first.get_attribute("value")
    referer = page.locator('input[name="_wp_http_referer"]').first.get_attribute("value") or ""
    if not nonce:
        raise RuntimeError("Could not read _wpnonce")
    body_pairs = list(pairs)
    body_pairs.insert(0, ("_wp_http_referer", referer))
    body_pairs.insert(0, ("_wpnonce", nonce))
    response = context.request.post(
        f"{wp['adminUrl']}/options.php",
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        data=urlencode(body_pairs),
    )
    return response.status


def save_site_manager_contact(context, wp: dict, page) -> int:
    page.goto(
        f"{wp['adminUrl']}/admin.php?page=ybb-site-manager&tab=contact",
        wait_until="domcontentloaded",
    )
    maybe_login(page, wp)
    pairs = [
        ("option_page", "ybb_sm_group"),
        ("action", "update"),
        ("ybb_sm_module", "contact"),
        (f"{OPT}[contact][salesEmail]", SALES_EMAIL),
        (f"{OPT}[contact][phoneNumber]", ""),
        (f"{OPT}[contact][companyLegalName]", "YBB Tackle Co., Ltd."),
        (f"{OPT}[contact][companyLegalNameZh]", ""),
        (f"{OPT}[contact][intro][en]", ""),
        (f"{OPT}[contact][intro][zh]", ""),
        (f"{OPT}[contact][intro][ja]", ""),
        (f"{OPT}[contact][hoursDetail][en]", ""),
        (f"{OPT}[contact][hoursDetail][zh]", ""),
        (f"{OPT}[contact][hoursDetail][ja]", ""),
        ("submit", "保存"),
    ]
    return post_options(context, wp, page, pairs)


def save_ybb_contact_option(context, wp: dict, page) -> int:
    page.goto(f"{wp['adminUrl']}/options-general.php?page=ybb-contact", wait_until="domcontentloaded")
    maybe_login(page, wp)
    pairs = [
        ("option_page", "ybb_contact_group"),
        ("action", "update"),
        (f"{CONTACT_OPT}[recipientEmail]", SALES_EMAIL),
        (f"{CONTACT_OPT}[rateLimitPerHour]", "10"),
        ("submit", "保存"),
    ]
    return post_options(context, wp, page, pairs)


def save_woocommerce_email(context, wp: dict, page) -> int:
    page.goto(
        f"{wp['adminUrl']}/admin.php?page=wc-settings&tab=email",
        wait_until="domcontentloaded",
    )
    maybe_login(page, wp)
    pairs = [
        ("option_page", "woocommerce"),
        ("action", "update"),
        ("_wp_http_referer", "/wp-admin/admin.php?page=wc-settings&tab=email"),
        ("woocommerce_email_from_name", FROM_NAME),
        ("woocommerce_email_from_address", FROM_EMAIL),
        ("submit", "Save changes"),
    ]
    nonce = page.locator('input[name="_wpnonce"]').first.get_attribute("value")
    if not nonce:
        raise RuntimeError("Could not read Woo _wpnonce")
    pairs.insert(0, ("_wpnonce", nonce))
    response = context.request.post(
        f"{wp['adminUrl']}/options.php",
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        data=urlencode(pairs),
    )
    return response.status


def main() -> int:
    wp = SECRETS["wordpress"]
    site = wp["siteUrl"].rstrip("/")
    capture: dict = {
        "at": datetime.now(timezone.utc).isoformat(),
        "salesEmail": SALES_EMAIL,
        "fromEmail": FROM_EMAIL,
    }

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()
        login(page, wp)

        capture["before"] = fetch_json(page, f"{site}/index.php?rest_route=/ybb/v1/contact-mail-status")
        capture["contactRestBefore"] = fetch_json(
            page, f"{site}/index.php?rest_route=/ybb/v1/site-manager/contact"
        )

        capture["saveSiteManagerContact"] = save_site_manager_contact(context, wp, page)
        capture["saveYbbContact"] = save_ybb_contact_option(context, wp, page)
        capture["saveWooEmail"] = save_woocommerce_email(context, wp, page)

        capture["after"] = fetch_json(page, f"{site}/index.php?rest_route=/ybb/v1/contact-mail-status")
        capture["contactRestAfter"] = fetch_json(
            page, f"{site}/index.php?rest_route=/ybb/v1/site-manager/contact"
        )
        browser.close()

    REPORT.parent.mkdir(parents=True, exist_ok=True)
    REPORT.write_text(json.dumps(capture, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {REPORT}")
    after = capture["after"]["body"]
    print("recipient:", after.get("recipientEmail"))
    print("siteManagerSalesEmail:", after.get("siteManagerSalesEmail"))
    print("woocommerceFrom:", after.get("woocommerceFrom"))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
