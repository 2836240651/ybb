#!/usr/bin/env python3
"""Global wp-admin audit: routes, REST, headless, captcha, static coexistence."""
from __future__ import annotations

import json
import re
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

SITE = "https://carp-ybb.com"
ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "reports" / "wp-admin-global-audit.json"


def fetch(url: str, headers: dict | None = None) -> dict:
    h = {"User-Agent": "ybb-global-audit/1.0", "Cache-Control": "no-cache"}
    if headers:
        h.update(headers)
    req = urllib.request.Request(url, headers=h)
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            body = resp.read().decode("utf-8", errors="ignore")
            hdrs = {k.lower(): v for k, v in resp.headers.items()}
            return {
                "url": url,
                "status": resp.status,
                "headers": hdrs,
                "len": len(body),
                "body_preview": body[:400],
                "captcha": _is_captcha(resp.status, body, hdrs),
                "title": _title(body),
            }
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="ignore")
        hdrs = {k.lower(): v for k, v in exc.headers.items()}
        return {
            "url": url,
            "status": exc.code,
            "headers": hdrs,
            "len": len(body),
            "body_preview": body[:400],
            "captcha": _is_captcha(exc.code, body, hdrs),
            "title": _title(body),
            "error": str(exc),
        }
    except Exception as exc:
        return {"url": url, "error": repr(exc)}


def _is_captcha(status: int, body: str, hdrs: dict) -> bool:
    low = body.lower()
    return (
        status in (202, 403)
        or "sgcaptcha" in low
        or "sg-captcha" in str(hdrs).lower()
        or ".well-known/sgcaptcha" in low
    )


def _title(body: str) -> str:
    m = re.search(r"<title>([^<]+)</title>", body, re.I)
    return m.group(1).strip() if m else ""


def main() -> int:
    bust = int(time.time() * 1000)
    urls = [
        f"{SITE}/",
        f"{SITE}/wp-login.php",
        f"{SITE}/wp-admin/index.php",
        f"{SITE}/wp-admin/index.php?sg_auto=1",
        f"{SITE}/wp-json/",
        f"{SITE}/wp-json/ybb/v1/deploy/status?_={bust}",
        f"{SITE}/wp-json/wc/store/v1/products?per_page=1",
        f"{SITE}/checkout/",
        f"{SITE}/index.php",
    ]
    results = [fetch(u) for u in urls]

  # public IP seen by server in captcha if any
    cap = next((r for r in results if r.get("captcha")), None)
    ip_in_body = None
    if cap:
        m = re.search(r"y=ip[cr]:([0-9.]+):", cap.get("body_preview", ""))
        if m:
            ip_in_body = m.group(1)

    summary = {
        "auditedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "captchaIpSeenInChallenge": ip_in_body,
        "findings": [],
        "results": results,
    }

    login = next(r for r in results if "wp-login" in r["url"])
    admin = next(r for r in results if r["url"].endswith("/wp-admin/index.php"))
    rest = next(r for r in results if r["url"].endswith("/wp-json/"))

    if login.get("captcha") and admin.get("captcha"):
        summary["findings"].append(
            {
                "severity": "blocker",
                "layer": "SiteGround SG-Captcha (nginx edge)",
                "detail": "wp-login and wp-admin return HTTP 202 meta-refresh to /.well-known/sgcaptcha/ before WordPress runs.",
            }
        )
    elif login.get("status") == 200 and admin.get("status") in (302, 200):
        summary["findings"].append(
            {
                "severity": "ok",
                "layer": "WordPress routing",
                "detail": "Admin paths reach WordPress (no edge captcha on this egress IP).",
            }
        )

    if rest.get("status") == 200 and not rest.get("captcha"):
        summary["findings"].append(
            {
                "severity": "info",
                "layer": "wp-json",
                "detail": "REST API reachable — static/htaccess coexistence OK for API.",
            }
        )
    elif rest.get("captcha"):
        summary["findings"].append(
            {
                "severity": "warning",
                "layer": "wp-json",
                "detail": "REST also captcha-blocked on this IP.",
            }
        )

    if admin.get("title") == login.get("title") and "Log In" in (admin.get("title") or ""):
        summary["findings"].append(
            {
                "severity": "info",
                "layer": "auth",
                "detail": "wp-admin/index.php serves login form when unauthenticated (expected).",
            }
        )

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(summary, indent=2, ensure_ascii=False), encoding="utf-8")

    print("=== Global WP Admin Audit ===")
    print(f"captcha IP in challenge: {ip_in_body or '(none)'}")
    for r in results:
        print(
            f"{r.get('status')} len={r.get('len')} captcha={r.get('captcha')} "
            f"title={r.get('title','')[:40]!r} {r['url']}"
        )
    print("\nFindings:")
    for f in summary["findings"]:
        print(f"  [{f['severity']}] {f['layer']}: {f['detail']}")
    print(f"\nreport: {OUT}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
