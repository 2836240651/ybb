#!/usr/bin/env python3
"""Configure Outlook SMTP for YBB contact inquiries on production WP."""
from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlencode

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
SECRETS = json.loads((ROOT / "secrets.local.json").read_text(encoding="utf-8"))
REPORT = ROOT / "reports" / "outlook-smtp-configure.json"

CONTACT_OPT = "ybb_contact_settings"
OPT = "ybb_site_manager_settings"

OUTLOOK = SECRETS.get("gmail") or SECRETS.get("outlook", {})
SALES_EMAIL = OUTLOOK.get("email", "carpybb@gmail.com")
SMTP_PASS = OUTLOOK.get("password", "")
SMTP_HOST = OUTLOOK.get("smtpHost", "smtp.gmail.com")
SMTP_PORT = str(OUTLOOK.get("smtpPort", 587))
SMTP_ENCRYPTION = OUTLOOK.get("smtpEncryption", "tls")
FROM_NAME = OUTLOOK.get("fromName", "YBB")


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
          const res = await fetch(url, { headers: { Accept: 'application/json' }, cache: 'no-store' });
          return { status: res.status, body: await res.json() };
        }""",
        path,
    )


def post_options(context, wp: dict, page, pairs: list[tuple[str, str]], referer_path: str) -> int:
    page.goto(f"{wp['adminUrl']}{referer_path}", wait_until="domcontentloaded")
    maybe_login(page, wp)
    page.wait_for_timeout(1500)
    nonce = page.locator('input[name="_wpnonce"]').first.get_attribute("value", timeout=60000)
    referer = page.locator('input[name="_wp_http_referer"]').first.get_attribute("value") or referer_path
    if not nonce:
        raise RuntimeError(f"Could not read _wpnonce from {referer_path}")
    body_pairs = list(pairs)
    body_pairs.insert(0, ("_wp_http_referer", referer))
    body_pairs.insert(0, ("_wpnonce", nonce))
    response = context.request.post(
        f"{wp['adminUrl']}/options.php",
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        data=urlencode(body_pairs),
    )
    return response.status


def save_contact_smtp(context, wp: dict, page) -> int:
    pairs = [
        ("option_page", "ybb_contact_group"),
        ("action", "update"),
        (f"{CONTACT_OPT}[recipientEmail]", SALES_EMAIL),
        (f"{CONTACT_OPT}[rateLimitPerHour]", "10"),
        (f"{CONTACT_OPT}[smtp][host]", SMTP_HOST),
        (f"{CONTACT_OPT}[smtp][port]", SMTP_PORT),
        (f"{CONTACT_OPT}[smtp][encryption]", SMTP_ENCRYPTION),
        (f"{CONTACT_OPT}[smtp][user]", SALES_EMAIL),
        (f"{CONTACT_OPT}[smtp][pass]", SMTP_PASS),
        ("submit", "保存"),
    ]
    return post_options(context, wp, page, pairs, "/options-general.php?page=ybb-contact")


def save_site_manager_contact(context, wp: dict, page) -> int:
    pairs = [
        ("option_page", "ybb_sm_group"),
        ("action", "update"),
        ("ybb_sm_module", "contact"),
        (f"{OPT}[contact][salesEmail]", SALES_EMAIL),
        (f"{OPT}[contact][phoneNumber]", ""),
        (f"{OPT}[contact][companyLegalName]", "Hangzhou Tuodiao Fishing Tackle Co., Ltd."),
        (f"{OPT}[contact][companyLegalNameZh]", ""),
        (f"{OPT}[contact][intro][en]", ""),
        (f"{OPT}[contact][intro][zh]", ""),
        (f"{OPT}[contact][intro][ja]", ""),
        (f"{OPT}[contact][hoursDetail][en]", ""),
        (f"{OPT}[contact][hoursDetail][zh]", ""),
        (f"{OPT}[contact][hoursDetail][ja]", ""),
        ("submit", "保存"),
    ]
    return post_options(context, wp, page, pairs, "/admin.php?page=ybb-site-manager&tab=contact")


def main() -> int:
    if not SMTP_PASS:
        raise SystemExit("secrets.local.json missing gmail/outlook password")

    wp = SECRETS["wordpress"]
    site = wp["siteUrl"].rstrip("/")
    capture: dict = {
        "at": datetime.now(timezone.utc).isoformat(),
        "salesEmail": SALES_EMAIL,
        "smtpHost": SMTP_HOST,
        "smtpPort": SMTP_PORT,
    }

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()
        login(page, wp)

        ts = int(datetime.now(timezone.utc).timestamp())
        capture["before"] = fetch_json(
            page, f"{site}/index.php?rest_route=/ybb/v1/contact-mail-status&_={ts}"
        )
        capture["saveContactSmtp"] = save_contact_smtp(context, wp, page)
        capture["saveSiteManagerContact"] = save_site_manager_contact(context, wp, page)
        capture["after"] = fetch_json(
            page, f"{site}/index.php?rest_route=/ybb/v1/contact-mail-status&_={ts + 1}"
        )
        browser.close()

    REPORT.parent.mkdir(parents=True, exist_ok=True)
    REPORT.write_text(json.dumps(capture, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {REPORT}")
    after = capture["after"]["body"]
    print("smtpConfigured:", after.get("smtpConfigured"))
    print("smtpUser:", after.get("smtpUser"))
    print("recipient:", after.get("recipientEmail"))
    print("contactFrom:", after.get("contactFrom"))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
