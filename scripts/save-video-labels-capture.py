#!/usr/bin/env python3
"""Fill video module tri-labels in YBB Site Manager, save, capture REST + form POST."""
from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
SECRETS = json.loads((ROOT / "secrets.local.json").read_text(encoding="utf-8"))
REPORT = ROOT / "reports" / "video-labels-capture.json"

LABELS = {
    "title": {
        "en": "30+ Years of Terminal Tackle Manufacturing",
        "zh": "30+ 年终端钓具制造经�?,
        "ja": "30年以上のターミナルタックル製�?,
    },
    "body": {
        "en": "Tour our production floor �?sinkers, rigs, bait cages, and OEM programs built for global brands.",
        "zh": "走进生产车间——铅坠、钓组、饵笼，以及面向全球品牌�?OEM 定制生产线�?,
        "ja": "生産現場をご案内——シンカー、リグ、餌籠、そして世界のブランド向けOEMプログラム�?,
    },
    "cta": {
        "en": "Request a factory visit",
        "zh": "预约工厂参观",
        "ja": "工場見学を申し込む",
    },
}

REST_PATH = "/index.php?rest_route=/ybb/v1/site-manager/factory-video"


def field_name(key: str, locale: str) -> str:
    return f"ybb_site_manager_settings[video][labels][{key}][{locale}]"


def fetch_rest_in_browser(page) -> dict:
    return page.evaluate(
        """async (url) => {
          const res = await fetch(url, { headers: { Accept: 'application/json' } });
          return { status: res.status, body: await res.json() };
        }""",
        REST_PATH,
    )


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


def pass_sgcaptcha(page, wp: dict) -> None:
    page.goto(wp["siteUrl"], wait_until="domcontentloaded")
    for _ in range(40):
        if "sgcaptcha" not in page.url:
            return
        page.wait_for_timeout(1000)
    raise RuntimeError(f"SiteGround captcha not cleared: {page.url}")


def goto_video_admin(page, wp: dict) -> None:
    pass_sgcaptcha(page, wp)
    page.goto(f"{wp['siteUrl']}/wp-login.php", wait_until="domcontentloaded")
    maybe_login(page, wp)
    url = f"{wp['adminUrl']}/admin.php?page=ybb-site-manager&tab=video"
    for _ in range(3):
        page.goto(url, wait_until="domcontentloaded")
        if "sgcaptcha" in page.url:
            pass_sgcaptcha(page, wp)
            continue
        maybe_login(page, wp)
        if "wp-login.php" not in page.url and page.locator(
            'input[name^="ybb_site_manager_settings[video][labels]"]'
        ).count():
            return
    debug = ROOT / "reports" / "video-labels-debug.html"
    debug.write_text(page.content(), encoding="utf-8")
    raise RuntimeError(f"Cannot open video admin �?saved {debug} url={page.url}")


def main() -> None:
    wp = SECRETS["wordpress"]
    capture: dict = {
        "at": datetime.now(timezone.utc).isoformat(),
        "restBefore": None,
        "restAfter": None,
        "savePost": None,
        "labelsSubmitted": LABELS,
        "network": [],
    }

    network: list[dict] = []

    def on_request(req):
        if req.method == "POST" and "options.php" in req.url:
            network.append(
                {
                    "phase": "request",
                    "method": req.method,
                    "url": req.url,
                    "postData": req.post_data,
                }
            )

    def on_response(res):
        url = res.url
        if "factory-video" not in url and "options.php" not in url:
            return
        if "options.php" in url and res.request.method != "POST":
            return
        entry = {"phase": "response", "method": res.request.method, "url": url, "status": res.status}
        try:
            ct = res.headers.get("content-type", "")
            if "application/json" in ct:
                entry["body"] = res.json()
            elif "factory-video" in url:
                entry["body"] = res.text()
        except Exception:
            entry["body"] = None
        network.append(entry)

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.on("response", on_response)
        page.on("request", on_request)

        goto_video_admin(page, wp)

        capture["restBefore"] = fetch_rest_in_browser(page)

        for key, locales in LABELS.items():
            for locale, value in locales.items():
                page.locator(f'input[name="{field_name(key, locale)}"]').fill(value)

        page.get_by_role("button", name="保存").click()
        page.wait_for_url("**settings-updated=true**", timeout=30000)
        page.wait_for_timeout(1500)

        capture["restAfter"] = fetch_rest_in_browser(page)

        # Public homepage fetch (same browser session, bypasses SG captcha on REST)
        page.goto(f"{wp['siteUrl']}/", wait_until="domcontentloaded")
        capture["restAfterHomepage"] = fetch_rest_in_browser(page)

        browser.close()

    capture["network"] = network
    capture["savePost"] = next(
        (n for n in network if n.get("phase") == "request" and "options.php" in n.get("url", "")),
        None,
    )

    REPORT.parent.mkdir(parents=True, exist_ok=True)
    REPORT.write_text(json.dumps(capture, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {REPORT}")
    after = capture["restAfter"]["body"]["labels"]
    print("title.zh:", after["title"]["zh"])
    print("body.zh:", after["body"]["zh"])
    print("cta.ja:", after["cta"]["ja"])


if __name__ == "__main__":
    main()
