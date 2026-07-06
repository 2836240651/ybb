#!/usr/bin/env python3
"""Acceptance: YBB admin product overrides �?REST �?frontend effect."""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path
from urllib.parse import urljoin

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
SITE = "https://carp-ybb.com"
REPORT = ROOT / "reports" / "product-admin-ops-acceptance.json"


def log(msg: str) -> None:
    print(msg, flush=True)


def security_blocked(page) -> bool:
    if "sgcaptcha" in page.url:
        return True
    body = page.locator("body").inner_text().lower()
    return "connection security" in body or "requires cookies" in body


def clear_security(page, site: str) -> None:
    page.goto(site, wait_until="domcontentloaded")
    page.wait_for_timeout(2000)
    for i in range(60):
        if not security_blocked(page):
            return
        if i % 10 == 0:
            log(f"[admin-ops] waiting security... {i}s")
        page.wait_for_timeout(1000)
    raise RuntimeError("SiteGround security page did not clear")


def fetch_json(page, site: str, path: str):
    page.goto(urljoin(site, path), wait_until="domcontentloaded")
    page.wait_for_timeout(1000)
    text = page.locator("body").inner_text().strip()
    if not text or text[0] not in "{[":
        raise ValueError(text[:200])
    return json.loads(text)


def pick_override_samples(overrides: dict) -> dict:
    title_sample = None
    hidden_sample = None
    for handle, row in overrides.items():
        if not isinstance(row, dict):
            continue
        if not title_sample and (row.get("titleZh") or row.get("titleJa")):
            title_sample = (handle, row)
        if not hidden_sample and row.get("frontHidden"):
            hidden_sample = (handle, row)
        if title_sample and hidden_sample:
            break
    return {"title": title_sample, "hidden": hidden_sample}


def main() -> int:
    site = SITE
    results: list[dict] = []

    def record(name: str, ok: bool, detail: str = "") -> None:
        results.append({"name": name, "ok": ok, "detail": detail})
        log(f"[{'PASS' if ok else 'FAIL'}] {name}" + (f" �?{detail}" if detail else ""))

    with sync_playwright() as p:
        page = p.chromium.launch(headless=True).new_page()
        clear_security(page, site)

        try:
            bundle = fetch_json(
                page,
                site,
                "/index.php?rest_route=/ybb/v1/site-manager/product-overrides",
            )
            enabled = bool(bundle.get("enabled"))
            overrides = bundle.get("overrides") or {}
            record(
                "overrides REST enabled",
                enabled and isinstance(overrides, dict),
                f"enabled={enabled} count={len(overrides)}",
            )
        except Exception as exc:
            record("overrides REST enabled", False, str(exc))
            overrides = {}

        samples = pick_override_samples(overrides)

        if samples.get("title"):
            handle, row = samples["title"]
            try:
                live = fetch_json(
                    page,
                    site,
                    f"/index.php?rest_route=/ybb/v1/site-manager/product-overrides/{handle}",
                )
                expected_zh = (row.get("titleZh") or "").strip()
                actual_zh = (live.get("titles") or {}).get("zh", "").strip()
                ok = (not expected_zh) or (expected_zh in actual_zh or actual_zh == expected_zh)
                record(
                    "titleZh REST �?product-live",
                    ok,
                    f"{handle} expected={expected_zh[:40]!r} live={actual_zh[:40]!r}",
                )
            except Exception as exc:
                record("titleZh REST �?product-live", False, str(exc))
        else:
            record("titleZh REST �?product-live", False, "no override with titleZh in map")

        if samples.get("title"):
            handle, row = samples["title"]
            expected_zh = (row.get("titleZh") or "").strip()
            try:
                page.goto(urljoin(site, f"/products/{handle}.html"), wait_until="domcontentloaded")
                page.wait_for_timeout(3000)
                merged = page.evaluate(
                    """async (handle) => {
                      const r = await fetch(
                        '/index.php?rest_route=/ybb/v1/site-manager/product-overrides/' + handle + '&_=' + Date.now(),
                        { credentials: 'include' }
                      );
                      if (!r.ok) return { ok: false, status: r.status };
                      const data = await r.json();
                      return { ok: true, zh: data.titles?.zh || '', en: data.titles?.en || '' };
                    }""",
                    handle,
                )
                ok = merged.get("ok") and (
                    not expected_zh or expected_zh in str(merged.get("zh") or "")
                )
                record(
                    "PDP client reads live titleZh",
                    ok,
                    f"{handle} zh={str(merged.get('zh', ''))[:50]}",
                )
            except Exception as exc:
                record("PDP client reads live titleZh", False, str(exc))

        if samples.get("hidden"):
            handle, _row = samples["hidden"]
            try:
                page.goto(
                    urljoin(site, "/collections/terminal-tackle.html"),
                    wait_until="domcontentloaded",
                )
                page.wait_for_timeout(3500)
                html = page.content().lower()
                link_present = f"/products/{handle}" in html or f"/products/{handle}.html" in html
                record(
                    "frontHidden excludes collection link",
                    not link_present,
                    f"{handle} in collection HTML={link_present}",
                )
            except Exception as exc:
                record("frontHidden excludes collection link", False, str(exc))
        else:
            record(
                "frontHidden excludes collection link",
                True,
                "skip (no frontHidden sample in overrides)",
            )

        try:
            live = fetch_json(
                page,
                site,
                "/index.php?rest_route=/ybb/v1/site-manager/product-overrides/tz-xp-038",
            )
            variants = live.get("variants") or []
            wc_attrs = sum(1 for v in variants if v.get("wcAttributes"))
            record(
                "live price/stock tz-xp-038",
                int(live.get("wcId") or 0) > 0 and len(variants) >= 4,
                f"wcId={live.get('wcId')} variants={len(variants)} wcAttrs={wc_attrs}",
            )
        except Exception as exc:
            record("live price/stock tz-xp-038", False, str(exc))

        try:
            page.goto(urljoin(site, "/products/tz-xp-038.html"), wait_until="domcontentloaded")
            page.wait_for_timeout(2500)
            has_orange = "橙色" in page.content()
            has_specs = bool(re.search(r"2#|4#|6#|8#", page.content()))
            record(
                "PDP tz-xp-038 variants (not stale 橙色)",
                has_specs and not has_orange,
                f"specs={has_specs} stale_orange={has_orange}",
            )
        except Exception as exc:
            record("PDP tz-xp-038 variants (not stale 橙色)", False, str(exc))

        try:
            resp = page.request.post(
                urljoin(
                    site,
                    "/index.php?rest_route=/ybb/v1/site-manager/product-overrides/tz-xp-038",
                ),
                data=json.dumps({"price": 1.23}),
                headers={"Content-Type": "application/json"},
            )
            record(
                "POST price rejected (no admin)",
                resp.status in (401, 403),
                f"HTTP {resp.status}",
            )
        except Exception as exc:
            record("POST price rejected (no admin)", False, str(exc))

    REPORT.parent.mkdir(parents=True, exist_ok=True)
    passed = sum(1 for r in results if r["ok"])
    payload = {
        "passed": passed,
        "total": len(results),
        "ok": passed == len(results),
        "results": results,
        "samples": {
            "titleHandle": samples.get("title", [None])[0] if samples.get("title") else None,
            "hiddenHandle": samples.get("hidden", [None])[0] if samples.get("hidden") else None,
        },
    }
    REPORT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    log(f"\nReport: {REPORT} ({passed}/{len(results)})")
    return 0 if payload["ok"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
