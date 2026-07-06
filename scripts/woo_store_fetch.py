"""Woo Store API fetch via curl (after Playwright clears SG Captcha cookies)."""

from __future__ import annotations

import json
import shutil
import subprocess
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Callable
from urllib.parse import urljoin

CookieProvider = Callable[[], str]

CURL_BIN = shutil.which("curl.exe") or shutil.which("curl") or "curl"


def cookies_header(cookies: list[dict]) -> str:
    parts: list[str] = []
    for cookie in cookies:
        name = cookie.get("name")
        if not name:
            continue
        parts.append(f"{name}={cookie.get('value', '')}")
    return "; ".join(parts)


def fetch_json_curl(
    site: str,
    path: str,
    cookie_header: str,
    *,
    timeout: int = 90,
) -> dict | list:
    base = urljoin(site.rstrip("/") + "/", path.lstrip("/"))
    sep = "&" if "?" in base else "?"
    url = f"{base}{sep}nocache={int(time.time() * 1000)}"
    proc = subprocess.run(
        [
            CURL_BIN,
            "-sS",
            "-H",
            f"Cookie: {cookie_header}",
            "-H",
            "Accept: application/json",
            url,
        ],
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        timeout=timeout,
    )
    if proc.returncode != 0:
        raise RuntimeError(proc.stderr.strip() or f"curl exit {proc.returncode} for {path}")
    text = proc.stdout.strip()
    if not text:
        raise ValueError(f"empty response: {path}")
    if text[0] not in "{[":
        lowered = text.lower()
        if "sgcaptcha" in lowered or "connection security" in lowered:
            raise PermissionError(f"captcha blocked: {path}")
        raise ValueError(f"non-json response: {text[:200]}")
    return json.loads(text)


def fetch_with_retry(
    site: str,
    path: str,
    cookie_provider: CookieProvider,
    *,
    retries: int = 3,
) -> dict | list:
    last: Exception | None = None
    for attempt in range(retries):
        try:
            return fetch_json_curl(site, path, cookie_provider())
        except PermissionError as exc:
            last = exc
            time.sleep(0.5 + attempt * 0.3)
        except Exception as exc:
            last = exc
            time.sleep(0.3 + attempt * 0.2)
    raise last or RuntimeError(f"fetch failed: {path}")


def fetch_product_pages(
    site: str,
    cookie_provider: CookieProvider,
    *,
    per_page: int = 100,
) -> list[dict]:
    parents: list[dict] = []
    page_no = 1
    while True:
        batch = fetch_with_retry(
            site,
            f"/index.php?rest_route=/wc/store/v1/products&per_page={per_page}&page={page_no}",
            cookie_provider,
        )
        if not isinstance(batch, list) or not batch:
            break
        for row in batch:
            if row.get("type") == "variation":
                continue
            parents.append(row)
        if len(batch) < per_page:
            break
        page_no += 1
    return parents


def fetch_variable_details(
    site: str,
    cookie_provider: CookieProvider,
    product_ids: list[int],
    *,
    workers: int = 10,
    on_progress: Callable[[int, int, int], None] | None = None,
) -> dict[int, dict]:
    if not product_ids:
        return {}

    details: dict[int, dict] = {}
    total = len(product_ids)

    def one(pid: int) -> tuple[int, dict]:
        payload = fetch_with_retry(
            site,
            f"/index.php?rest_route=/wc/store/v1/products/{pid}",
            cookie_provider,
        )
        if not isinstance(payload, dict):
            raise ValueError(f"product {pid}: expected object")
        return pid, payload

    done = 0
    with ThreadPoolExecutor(max_workers=max(1, workers)) as pool:
        futures = {pool.submit(one, pid): pid for pid in product_ids}
        for future in as_completed(futures):
            pid, payload = future.result()
            details[pid] = payload
            done += 1
            if on_progress and (done == 1 or done % 10 == 0 or done == total):
                on_progress(done, total, pid)

    return details
