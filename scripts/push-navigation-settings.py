#!/usr/bin/env python3
"""Push navigation primaryNav from defaults-data.json to production YBB Site Manager."""
from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlencode

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
SECRETS = json.loads((ROOT / "secrets.local.json").read_text(encoding="utf-8"))
DEFAULTS = json.loads(
    (
        ROOT
        / "deploy/wp-content/mu-plugins/ybb-site-manager/includes/defaults-data.json"
    ).read_text(encoding="utf-8")
)
REPORT = ROOT / "reports" / "navigation-push-capture.json"
REST_PATH = "/index.php?rest_route=/ybb/v1/site-manager/navigation"
OPT = "ybb_site_manager_settings"


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


def build_nav_post_pairs(nav: dict) -> list[tuple[str, str]]:
    pairs: list[tuple[str, str]] = [
        ("option_page", "ybb_sm_group"),
        ("action", "update"),
        ("ybb_sm_module", "navigation"),
    ]
    for i, item in enumerate(nav.get("primaryNav", [])):
        base = f"{OPT}[navigation][primaryNav][{i}]"
        pairs.append((f"{base}[enabled]", "0"))
        if item.get("enabled", True):
            pairs.append((f"{base}[enabled]", "1"))
        pairs.append((f"{base}[id]", item.get("id", f"nav-{i}")))
        pairs.append((f"{base}[label]", item.get("label", "")))
        pairs.append((f"{base}[href]", item.get("href", "")))
        labels = item.get("labels") or {}
        pairs.append((f"{base}[labels][zh]", labels.get("zh", "")))
        pairs.append((f"{base}[labels][ja]", labels.get("ja", "")))
        mega = item.get("megaMenu")
        if not mega:
            continue
        pairs.append((f"{base}[megaMenu][variant]", mega.get("variant", "category")))
        shop = mega.get("shopAll") or {}
        pairs.append((f"{base}[megaMenu][shopAll][label]", shop.get("label", "")))
        pairs.append((f"{base}[megaMenu][shopAll][href]", shop.get("href", "")))
        shop_labels = shop.get("labels") or {}
        pairs.append((f"{base}[megaMenu][shopAll][labels][zh]", shop_labels.get("zh", "")))
        pairs.append((f"{base}[megaMenu][shopAll][labels][ja]", shop_labels.get("ja", "")))
        for ci, child in enumerate(mega.get("children") or []):
            cb = f"{base}[megaMenu][children][{ci}]"
            pairs.append((f"{cb}[label]", child.get("label", "")))
            pairs.append((f"{cb}[href]", child.get("href", "")))
            child_labels = child.get("labels") or {}
            pairs.append((f"{cb}[labels][zh]", child_labels.get("zh", "")))
            pairs.append((f"{cb}[labels][ja]", child_labels.get("ja", "")))
    pairs.append(("submit", "保存"))
    return pairs


def fetch_rest_in_browser(page) -> dict:
    return page.evaluate(
        """async (url) => {
          const res = await fetch(url, { headers: { Accept: 'application/json' } });
          return { status: res.status, body: await res.json() };
        }""",
        REST_PATH,
    )


def main() -> None:
    wp = SECRETS["wordpress"]
    nav = DEFAULTS["navigation"]
    capture: dict = {
        "at": datetime.now(timezone.utc).isoformat(),
        "restBefore": None,
        "restAfter": None,
    }

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()

        pass_sgcaptcha(page, wp)
        page.goto(f"{wp['siteUrl']}/wp-login.php", wait_until="domcontentloaded")
        maybe_login(page, wp)

        page.goto(f"{wp['adminUrl']}/admin.php?page=ybb-site-manager&tab=navigation", wait_until="domcontentloaded")
        maybe_login(page, wp)
        if "wp-login.php" in page.url:
            browser.close()
            raise RuntimeError("Login failed")

        capture["restBefore"] = fetch_rest_in_browser(page)
        nonce = page.locator('input[name="_wpnonce"]').first.get_attribute("value")
        referer = page.locator('input[name="_wp_http_referer"]').first.get_attribute("value") or ""
        if not nonce:
            browser.close()
            raise RuntimeError("Could not read _wpnonce from navigation admin page")

        pairs = build_nav_post_pairs(nav)
        pairs.insert(2, ("_wpnonce", nonce))
        pairs.insert(3, ("_wp_http_referer", referer))
        body = urlencode(pairs)

        response = context.request.post(
            f"{wp['adminUrl']}/options.php",
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            data=body,
        )
        capture["saveStatus"] = response.status
        capture["saveUrl"] = response.url

        page.goto(f"{wp['adminUrl']}/admin.php?page=ybb-site-manager&tab=navigation&settings-updated=true", wait_until="domcontentloaded")
        capture["restAfter"] = fetch_rest_in_browser(page)
        browser.close()

    before_labels = [i.get("label") for i in capture["restBefore"]["body"].get("primaryNav", [])]
    after_labels = [i.get("label") for i in capture["restAfter"]["body"].get("primaryNav", [])]
    capture["summary"] = {"before": before_labels, "after": after_labels}

    REPORT.parent.mkdir(parents=True, exist_ok=True)
    REPORT.write_text(json.dumps(capture, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {REPORT}")
    print("save status:", capture["saveStatus"])
    print("nav after:", " | ".join(after_labels))
    mega_count = sum(1 for i in capture["restAfter"]["body"].get("primaryNav", []) if i.get("megaMenu"))
    print("mega menus:", mega_count)


if __name__ == "__main__":
    main()
