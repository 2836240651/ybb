#!/usr/bin/env python3
"""Trace wp-login -> wp-admin HTTP chain (redirects, captcha, body)."""
from __future__ import annotations

import json
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from http.cookiejar import CookieJar
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SECRETS = ROOT / "secrets.local.json"
SITE = "https://carp-ybb.com"
UA = "ybb-wp-trace/1.0"


def req(
    opener,
    url: str,
    *,
    method: str = "GET",
    data: dict | None = None,
    label: str = "",
) -> dict:
    headers = {"User-Agent": UA}
    if data:
        body = urllib.parse.urlencode(data).encode()
        headers["Content-Type"] = "application/x-www-form-urlencoded"
        r = urllib.request.Request(url, data=body, headers=headers, method="POST")
    else:
        r = urllib.request.Request(url, headers=headers, method=method)

    out = {
        "label": label or url,
        "url": url,
        "status": None,
        "location": "",
        "headers": {},
        "body_len": 0,
        "body_preview": "",
        "captcha": False,
        "wp_redirect": False,
        "error": "",
    }
    try:
        with opener.open(r, timeout=60) as resp:
            body = resp.read().decode("utf-8", errors="ignore")
            out["status"] = resp.status
            out["headers"] = {k.lower(): v for k, v in resp.headers.items()}
            out["location"] = out["headers"].get("location", "")
            out["body_len"] = len(body)
            out["body_preview"] = body[:500].replace("\n", " ")
            low = body.lower()
            out["captcha"] = (
                "sgcaptcha" in low
                or "sg-captcha" in str(out["headers"]).lower()
                or out["status"] in (202, 403)
                or ".well-known/sgcaptcha" in low
            )
            out["wp_redirect"] = out["headers"].get("x-redirect-by", "").lower() == "wordpress"
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="ignore")
        out["status"] = exc.code
        out["headers"] = {k.lower(): v for k, v in exc.headers.items()}
        out["location"] = out["headers"].get("location", "")
        out["body_len"] = len(body)
        out["body_preview"] = body[:500].replace("\n", " ")
        low = body.lower()
        out["captcha"] = (
            "sgcaptcha" in low
            or out["status"] in (202, 403)
            or ".well-known/sgcaptcha" in low
        )
        out["error"] = str(exc)
    except Exception as exc:
        out["error"] = repr(exc)
    return out


def follow_get(opener, url: str, label: str, depth: int = 0, max_depth: int = 8) -> list[dict]:
    chain: list[dict] = []
    current = url
    seen: set[str] = set()
    for i in range(max_depth):
        if current in seen:
            chain.append({"label": f"loop@{i}", "url": current, "error": "redirect loop"})
            break
        seen.add(current)
        step = req(opener, current, label=label if i == 0 else f"redirect-{i}")
        step["hop"] = i
        chain.append(step)
        loc = step.get("location") or ""
        if not loc or step.get("status") not in (301, 302, 303, 307, 308):
            break
        current = urllib.parse.urljoin(current, loc)
        label = f"redirect-{i+1}"
    return chain


def main() -> int:
    report: dict = {"site": SITE, "steps": []}

    jar = CookieJar()
    opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))

    targets = [
        (f"{SITE}/wp-login.php", "GET wp-login"),
        (f"{SITE}/wp-admin/", "GET wp-admin/"),
        (f"{SITE}/wp-admin/index.php", "GET wp-admin/index.php"),
        (f"{SITE}/wp-admin/index.php?sg_auto=1", "GET sg_auto login target"),
        (
            f"{SITE}/wp-admin/admin.php?page=ybb-site-manager",
            "GET YBB site manager",
        ),
    ]
    for url, label in targets:
        report["steps"].append({"chain": follow_get(opener, url, label)})

    if SECRETS.is_file():
        wp = json.loads(SECRETS.read_text(encoding="utf-8")).get("wordpress") or {}
        email = wp.get("email") or ""
        password = wp.get("password") or ""
        if email and password:
            login_page = req(opener, f"{SITE}/wp-login.php", label="login page before POST")
            html = login_page.get("body_preview", "")
            nonce_m = re.search(r'name="_wpnonce" value="([^"]+)"', html)
            post = {
                "log": email,
                "pwd": password,
                "wp-submit": "Log In",
                "redirect_to": f"{SITE}/wp-admin/index.php",
                "testcookie": "1",
            }
            if nonce_m:
                post["_wpnonce"] = nonce_m.group(1)
            login_post = req(
                opener,
                f"{SITE}/wp-login.php",
                data=post,
                label="POST wp-login",
            )
            report["steps"].append({"chain": [login_page, login_post]})
            if login_post.get("location"):
                report["steps"].append(
                    {
                        "chain": follow_get(
                            opener,
                            urllib.parse.urljoin(f"{SITE}/wp-login.php", login_post["location"]),
                            "after login Location",
                        )
                    }
                )
            for after_url, after_label in [
                (f"{SITE}/wp-admin/index.php", "authenticated wp-admin/index.php"),
                (
                    f"{SITE}/wp-admin/admin.php?page=ybb-site-manager",
                    "authenticated YBB admin",
                ),
            ]:
                report["steps"].append({"chain": follow_get(opener, after_url, after_label)})

    out_path = ROOT / "reports" / "wp-admin-trace.json"
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")

    print("=== WP Admin HTTP Trace ===")
    for block in report["steps"]:
        print(f"\n--- {block['chain'][0].get('label', '?')} ---")
        for hop in block["chain"]:
            st = hop.get("status")
            cap = "CAPTCHA" if hop.get("captcha") else ""
            wp = "WP" if hop.get("wp_redirect") else ""
            loc = hop.get("location") or ""
            print(
                f"  [{hop.get('hop', 0)}] HTTP {st} len={hop.get('body_len')} "
                f"{cap} {wp} loc={loc[:80]}"
            )
            prev = hop.get("body_preview", "")
            if prev:
                print(f"       body: {prev[:160]}")
            if hop.get("error"):
                print(f"       err: {hop['error']}")
    print(f"\n[report] {out_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
