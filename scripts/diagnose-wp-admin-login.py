#!/usr/bin/env python3
"""Diagnose wp-login -> wp-admin redirect (cookie session)."""
from __future__ import annotations

import json
import re
import sys
import urllib.parse
import urllib.request
from http.cookiejar import CookieJar
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SECRETS = ROOT / "secrets.local.json"
SITE = "https://carp-ybb.com"


def fetch(opener, url: str, data: dict | None = None) -> tuple[int, str, dict]:
    if data:
        body = urllib.parse.urlencode(data).encode()
        req = urllib.request.Request(
            url,
            data=body,
            headers={
                "Content-Type": "application/x-www-form-urlencoded",
                "User-Agent": "ybb-wp-admin-diagnose/1.0",
            },
            method="POST",
        )
    else:
        req = urllib.request.Request(url, headers={"User-Agent": "ybb-wp-admin-diagnose/1.0"})
    with opener.open(req, timeout=60) as resp:
        text = resp.read().decode("utf-8", errors="ignore")
        return resp.status, text, dict(resp.headers)


def main() -> int:
    if not SECRETS.is_file():
        print("missing secrets.local.json", file=sys.stderr)
        return 1
    wp = json.loads(SECRETS.read_text(encoding="utf-8")).get("wordpress") or {}
    email = wp.get("email") or ""
    password = wp.get("password") or ""
    if not email or not password:
        print("missing wordpress credentials", file=sys.stderr)
        return 1

    jar = CookieJar()
    opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))

    login_url = f"{SITE}/wp-login.php"
    status, html, _ = fetch(opener, login_url)
    print(f"[login-page] HTTP {status} len={len(html)}")

    m = re.search(r'name="_wpnonce" value="([^"]+)"', html)
    nonce = m.group(1) if m else ""
    redirect_to = f"{SITE}/wp-admin/"
    post = {
        "log": email,
        "pwd": password,
        "wp-submit": "Log In",
        "redirect_to": redirect_to,
        "testcookie": "1",
    }
    if nonce:
        post["_wpnonce"] = nonce

    status, body, headers = fetch(opener, login_url, post)
    loc = headers.get("Location") or headers.get("location") or ""
    print(f"[login-post] HTTP {status} location={loc!r} len={len(body)}")
    if "sgcaptcha" in body.lower() or "sg-captcha" in str(headers).lower():
        print("[login-post] CAPTCHA detected in response")
    if "incorrect" in body.lower() or "invalid_username" in body.lower():
        print("[login-post] login may have failed (check credentials)")

    for path in ("/wp-admin/", "/wp-admin/index.php", "/wp-admin/edit.php"):
        url = f"{SITE}{path}"
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "ybb-wp-admin-diagnose/1.0"})
            with opener.open(req, timeout=60) as resp:
                text = resp.read().decode("utf-8", errors="ignore")
                print(
                    f"[after-login] {path} HTTP {resp.status} len={len(text)} "
                    f"title={_title(text)!r} captcha={'sgcaptcha' in text.lower()}"
                )
        except urllib.error.HTTPError as exc:
            text = exc.read().decode("utf-8", errors="ignore")
            print(
                f"[after-login] {path} HTTP {exc.code} len={len(text)} "
                f"body={text[:120]!r}"
            )

    return 0


def _title(html: str) -> str:
    m = re.search(r"<title>([^<]+)</title>", html, re.I)
    return m.group(1).strip() if m else ""


if __name__ == "__main__":
    sys.exit(main())
