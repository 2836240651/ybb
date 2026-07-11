#!/usr/bin/env python3
"""SiteGround browser-first deploy helpers (no direct FTPS for production sync)."""

from __future__ import annotations

import json
import re
import subprocess
import time
import urllib.parse
import urllib.request
import webbrowser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SECRETS = ROOT / "secrets.local.json"
DEPLOY_DIR = ROOT / "deploy"
SITE_URL = "https://carp-ybb.com"
RESTORE_KEY = "ybb-migrate-20260624"
RESTORE_PHP = DEPLOY_DIR / "restore-htaccess.php"
RESTORE_DATA = DEPLOY_DIR / "htaccess.restore"
ZIP_PATH = DEPLOY_DIR / "ybb-static-export.zip"
UNZIP_PHP = DEPLOY_DIR / "unzip-export.php"
FILE_MANAGER_BASE = "https://tools.siteground.com/filemanager"

ROUTE_CHECKS = (
    "/collections/sinkers/",
    "/products/tz-qz-025/",
    "/wp-json/",
    "/checkout/",
)

WC_AJAX_CHECKS = (
    ("/?wc-ajax=get_refreshed_fragments", "json"),
    ("/checkout/?wc-ajax=get_refreshed_fragments", "json"),
)


def load_secrets() -> dict:
    if not SECRETS.exists():
        raise FileNotFoundError("Missing secrets.local.json")
    return json.loads(SECRETS.read_text(encoding="utf-8"))


def file_manager_url(secrets: dict | None = None) -> str:
    secrets = secrets or load_secrets()
    site_id = secrets.get("deploy", {}).get("siteToolsSiteId", "")
    if not site_id:
        raise ValueError("secrets.local.json deploy.siteToolsSiteId is required")
    return f"{FILE_MANAGER_BASE}?siteId={site_id}"


def prepare_htaccess_bundle(stamp: str | None = None) -> Path:
    from deploy_upload import merge_htaccess

    stamp = stamp or time.strftime("%Y%m%d-%H%M%S")
    merged = merge_htaccess(stamp)
    RESTORE_DATA.write_bytes(merged.read_bytes())
    print(f"[siteground] prepared {RESTORE_DATA.name} ({RESTORE_DATA.stat().st_size} bytes)")
    return merged


def open_file_manager(secrets: dict | None = None) -> str:
    url = file_manager_url(secrets)
    print(f"[siteground] open File Manager: {url}")
    webbrowser.open(url)
    return url


def curl_text(url: str, *, timeout: int = 120, method: str = "GET", body: str | None = None) -> tuple[int, str]:
    data = body.encode("utf-8") if body is not None else None
    req = urllib.request.Request(
        url,
        data=data,
        method=method,
        headers={
            "User-Agent": "ybb-siteground-deploy/1.0",
            "Cache-Control": "no-cache, no-store, max-age=0",
            "Pragma": "no-cache",
            **(
                {"Content-Type": "application/x-www-form-urlencoded"}
                if method.upper() != "GET"
                else {}
            ),
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return resp.status, resp.read().decode("utf-8", errors="ignore")
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="ignore")
        return exc.code, body


def _is_captcha_response(status: int, body: str) -> bool:
    if status in (202, 403):
        return True
    lowered = body.lower()
    return "sgcaptcha" in lowered or ".well-known/sgcaptcha" in lowered


def _wait_past_site_captcha(page, *, max_seconds: int = 90) -> None:
    page.goto(SITE_URL + "/", wait_until="domcontentloaded")
    for _ in range(max_seconds):
        url = page.url
        try:
            text = page.locator("body").inner_text()
        except Exception:
            text = ""
        blocked = (
            "sgcaptcha" in url
            or "Checking the site connection security" in text
            or "requires cookies to be enabled" in text
        )
        if not blocked:
            return
        page.wait_for_timeout(1000)
    raise RuntimeError(f"SiteGround captcha not cleared after {max_seconds}s ({page.url})")


def _fetch_url_in_page(page, url: str, *, wait_needle: str | None = None, max_seconds: int = 60) -> str:
    _wait_past_site_captcha(page)
    page.goto(url, wait_until="domcontentloaded")
    for _ in range(max_seconds):
        text = page.locator("body").inner_text()
        if wait_needle and wait_needle in text:
            return text
        if wait_needle is None:
            return text
        if "sgcaptcha" not in page.url and "Checking the site connection security" not in text:
            return text
        page.wait_for_timeout(1000)
    return page.locator("body").inner_text()


def trigger_php_url_in_browser(url: str, *, success_needle: str | None = None) -> str:
    """Fetch deploy PHP URL in a browser session (bypasses SG Captcha on curl)."""
    from playwright.sync_api import sync_playwright

    last_body = ""

    with sync_playwright() as p:
        for connect in (
            lambda: p.chromium.connect_over_cdp("http://127.0.0.1:9224"),
            lambda: p.chromium.connect_over_cdp("http://127.0.0.1:9222"),
        ):
            try:
                browser = connect()
                context = browser.contexts[0] if browser.contexts else browser.new_context()
                page = context.pages[0] if context.pages else context.new_page()
                print("[trigger] using Chrome CDP session")
                last_body = _fetch_url_in_page(page, url, wait_needle=success_needle)
                if not success_needle or success_needle in last_body:
                    return last_body
            except Exception:
                continue

        for headless in (True, False):
            browser = p.chromium.launch(headless=headless)
            page = browser.new_page()
            try:
                mode = "headless" if headless else "headed"
                print(f"[trigger] using Playwright chromium ({mode})")
                last_body = _fetch_url_in_page(page, url, wait_needle=success_needle)
                if not success_needle or success_needle in last_body:
                    return last_body
            finally:
                browser.close()

    raise RuntimeError(
        f"browser trigger failed �?last response: {last_body.strip()[:200]!r}"
    )


def trigger_php_url(path: str, success_needle: str, *, label: str) -> None:
    url = urllib.parse.urljoin(SITE_URL, path)
    status, body = curl_text(url)
    snippet = body.strip().replace("\n", " ")[:160]
    print(f"[trigger] {label} curl HTTP {status}: {snippet or '(empty)'}")

    if status == 200 and success_needle in body:
        return

    if _is_captcha_response(status, body) or success_needle not in body:
        print(f"[trigger] {label} �?curl blocked, using browser...")
        body = trigger_php_url_in_browser(url, success_needle=success_needle)
        snippet = body.strip().replace("\n", " ")[:160]
        print(f"[trigger] {label} browser: {snippet or '(empty)'}")
        if success_needle not in body:
            raise RuntimeError(f"{label} failed �?expected {success_needle!r} in response")
        return

    raise RuntimeError(f"{label} failed �?upload deploy artifacts first")


def trigger_unzip() -> None:
    trigger_php_url("/unzip-export.php", "extracted", label="unzip-export.php")


def trigger_htaccess_restore() -> None:
    trigger_php_url(
        f"/restore-htaccess.php?key={RESTORE_KEY}&nocache=1",
        "restored .htaccess",
        label="restore-htaccess.php",
    )


def verify_routes() -> list[str]:
    failures: list[str] = []
    for path in ROUTE_CHECKS:
        url = urllib.parse.urljoin(SITE_URL, path)
        status, _ = curl_text(url)
        ok = status in (200, 301, 302)
        print(f"[verify] {path} -> {status}{'' if ok else ' FAIL'}")
        if not ok:
            failures.append(f"{path} -> HTTP {status}")

    for path, kind in WC_AJAX_CHECKS:
        url = urllib.parse.urljoin(SITE_URL, path)
        status, body = curl_text(url, method="POST", body="security=test")
        is_json = body.strip().startswith("{")
        ok = status == 200 and (kind != "json" or is_json)
        print(
            f"[verify] {path} -> {status} "
            f"{'json' if is_json else 'html'}{'' if ok else ' FAIL'}"
        )
        if not ok:
            failures.append(f"{path} -> expected {kind}, got HTTP {status}")
    return failures


def _extract_build_id_from_html(html: str) -> str | None:
    if "<!--" not in html:
        return None
    start = html.index("<!--") + 4
    end = html.index("-->", start)
    if end <= start:
        return None
    return html[start:end].strip()


def fetch_remote_build_id() -> str | None:
    cache_bust = int(time.time() * 1000)
    url = f"{SITE_URL}/index.html?v={cache_bust}"
    status, html = curl_text(url)
    if status == 200:
        bid = _extract_build_id_from_html(html)
        if bid:
            return bid

    # Use ASCII-only log to avoid Windows console encoding issues (GBK).
    print("[deploy-siteground] buildId check blocked by captcha; trying browser...")
    from playwright.sync_api import sync_playwright

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            _wait_past_site_captcha(page)
            page.goto(url, wait_until="domcontentloaded")
            html = page.content()
        finally:
            browser.close()

    return _extract_build_id_from_html(html)


def upload_deploy_artifacts(
    files: list[Path],
    *,
    manual_upload: bool = False,
    auto_upload: bool = False,
) -> None:
    """Default: FTPS 4-file zip bundle. Optional: SiteGround FM browser or manual."""
    if manual_upload:
        open_file_manager()
        print_manual_upload_steps(files)
        input()
        return

    if auto_upload:
        code = run_browser_upload(files, wait_manual=True)
        if code != 0:
            raise RuntimeError("SiteGround File Manager upload failed")
        return

    print("[deploy-siteground] FTPS upload (zip + php helpers, not full static tree)")
    upload_files_ftps([(p, p.name) for p in files])


def run_browser_upload(files: list[Path], *, wait_manual: bool = False) -> int:
    script = ROOT / "scripts" / "upload-siteground-browser.mjs"
    if not script.exists():
        raise FileNotFoundError(script)

    args = ["node", str(script), "--files", *[str(p) for p in files]]
    if wait_manual:
        args.append("--wait-manual")

    print("[siteground] browser upload:", " ".join(args))
    result = subprocess.run(args, cwd=ROOT)
    return result.returncode


def print_manual_upload_steps(files: list[Path], secrets: dict | None = None) -> None:
    url = file_manager_url(secrets)
    names = ", ".join(p.name for p in files)
    print(
        f"""
[siteground] Manual upload (browser)
1. Open SiteGround File Manager: {url}
2. Enter site public_html (carp-ybb.com root)
3. Upload: {names}
4. Return here and press Enter to continue remote trigger steps
"""
    )


def cleanup_restore_artifacts_via_browser_note() -> None:
    print(
        "[siteground] After success, delete from public_html via File Manager:\n"
        "  - restore-htaccess.php\n"
        "  - htaccess.restore\n"
        "  - unzip-export.php\n"
        "  - ybb-static-export.zip (if still present)\n"
        "Then purge SiteGround cache (Speed Optimizer -> Purge Cache)."
    )


def upload_files_ftps(files: list[tuple[Path, str]]) -> None:
    """Upload small deploy artifacts when browser upload is not yet complete."""
    import os
    import time
    from ftplib import FTP_TLS, error_perm

    secrets = load_secrets()
    ftp = secrets["ftp"]
    remote_root = ftp.get("remoteRoot", "").rstrip("/") or "/carp-ybb.com/public_html"

    for local, remote_name in files:
        rel_path = remote_name.replace("\\", "/").lstrip("/")
        rel_dir = os.path.dirname(rel_path) or "."
        fname = os.path.basename(rel_path)
        last_exc: Exception | None = None
        for attempt in range(1, 4):
            client = FTP_TLS()
            try:
                client.connect(ftp["host"], int(ftp.get("port", 21)), timeout=300)
                client.login(ftp["username"], ftp["password"])
                client.prot_p()
                client.set_pasv(True)
                client.cwd(remote_root)
                if rel_dir not in (".", ""):
                    for part in rel_dir.split("/"):
                        if not part:
                            continue
                        try:
                            client.cwd(part)
                        except error_perm:
                            client.mkd(part)
                            client.cwd(part)
                print(f"[upload] FTPS {fname} ({local.stat().st_size} bytes)")
                with local.open("rb") as fh:
                    client.storbinary(f"STOR {fname}", fh, blocksize=64 * 1024)
                client.quit()
                last_exc = None
                break
            except Exception as exc:
                last_exc = exc
                print(f"[retry] FTPS {fname} attempt {attempt}/3: {exc}")
                try:
                    client.quit()
                except Exception:
                    pass
                time.sleep(5 * attempt)
        if last_exc:
            raise last_exc
