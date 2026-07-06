#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import time
from pathlib import Path
from typing import Any

from playwright.sync_api import Page, TimeoutError as PlaywrightTimeoutError, sync_playwright

ROOT = Path(__file__).resolve().parents[1]
SECRETS_PATH = ROOT / "secrets.local.json"
DEFAULT_SPEC_PATH = ROOT / "deploy" / "product-import" / "wp-product-spec.sample.json"
REPORT_PATH = ROOT / "deploy" / "product-import" / "wp-product-create-report.json"


def load_wp_secrets() -> dict[str, str]:
    data = json.loads(SECRETS_PATH.read_text(encoding="utf-8"))
    wp = data.get("wordpress", {})
    required = ["adminUrl", "email", "password"]
    missing = [k for k in required if not wp.get(k)]
    if missing:
        raise RuntimeError(f"missing wordpress keys in secrets.local.json: {missing}")
    return wp


def load_spec(path: Path) -> dict[str, Any]:
    raw = json.loads(path.read_text(encoding="utf-8"))
    required = ["title", "regularPrice", "sku"]
    missing = [k for k in required if not raw.get(k)]
    if missing:
        raise RuntimeError(f"missing required product spec fields: {missing}")
    return raw


def wait_visible(page: Page, selectors: list[str], timeout: int = 10000):
    last_error = None
    for sel in selectors:
        try:
            page.locator(sel).first.wait_for(state="visible", timeout=timeout)
            return page.locator(sel).first
        except Exception as err:  # noqa: BLE001
            last_error = err
    raise RuntimeError(f"none of selectors visible: {selectors}") from last_error


def click_first(page: Page, selectors: list[str], timeout: int = 10000):
    target = wait_visible(page, selectors, timeout=timeout)
    target.click()
    return target


def maybe_login(page: Page, wp: dict[str, str]):
    if "wp-login.php" not in page.url:
        return
    page.fill("#user_login", wp["email"])
    page.fill("#user_pass", wp["password"])
    page.click("#wp-submit")
    page.wait_for_load_state("domcontentloaded")


def goto_product_editor(page: Page, admin_url: str):
    page.goto(f"{admin_url}/post-new.php?post_type=product", wait_until="domcontentloaded")
    page.wait_for_timeout(1200)

    if page.locator("#title").count():
        return

    # Some accounts land on wc-admin onboarding pages first.
    add_links = [
        "a[href*='post-new.php?post_type=product']",
        "a:has-text('Add product')",
        "a:has-text('添加产品')",
        "button:has-text('Add product')",
        "button:has-text('添加产品')",
    ]
    for sel in add_links:
        loc = page.locator(sel).first
        if loc.count():
            try:
                loc.click()
                page.wait_for_load_state("domcontentloaded")
                page.wait_for_timeout(1200)
                if page.locator("#title").count():
                    return
            except Exception:  # noqa: BLE001
                continue


def fill_basic_fields(page: Page, spec: dict[str, Any]):
    page.fill("#title", spec["title"])

    if spec.get("description"):
        page.fill("#content", spec["description"])

    if spec.get("shortDescription"):
        page.fill("#excerpt", spec["shortDescription"])


def fill_product_data(page: Page, spec: dict[str, Any]):
    page.select_option("#product-type", spec.get("productType", "simple"))

    page.fill("#_regular_price", str(spec["regularPrice"]))
    if spec.get("salePrice"):
        page.fill("#_sale_price", str(spec["salePrice"]))

    page.fill("#_sku", spec["sku"])

    if spec.get("manageStock", True):
        manage_stock = page.locator("#_manage_stock")
        if manage_stock.count() and not manage_stock.is_checked():
            manage_stock.check()
        if spec.get("stockQty") is not None:
            page.fill("#_stock", str(spec["stockQty"]))


def select_categories(page: Page, categories: list[str]):
    if not categories:
        return
    page.locator("#product_catdiv").scroll_into_view_if_needed()
    for category in categories:
        cb = page.locator(f"#product_catdiv label:has-text('{category}') input[type='checkbox']").first
        if cb.count():
            cb.check()


def open_media_modal(page: Page, panel_selector: str):
    page.locator(panel_selector).scroll_into_view_if_needed()
    click_first(
        page,
        [
            f"{panel_selector} a:has-text('Set product image')",
            f"{panel_selector} a:has-text('设置产品图片')",
            f"{panel_selector} a:has-text('Add product gallery images')",
            f"{panel_selector} a:has-text('添加产品相册图片')",
            f"{panel_selector} .inside a",
        ],
    )
    wait_visible(page, [".media-modal"])


def upload_media_and_confirm(page: Page, files: list[str], select_button_texts: list[str]):
    if not files:
        return
    click_first(
        page,
        [
            ".media-modal .media-menu-item:has-text('Upload files')",
            ".media-modal .media-menu-item:has-text('上传文件')",
        ],
    )
    file_input = wait_visible(page, [".media-modal input[type='file']"])
    file_input.set_input_files(files)

    # Wait queue settles.
    page.wait_for_timeout(2500)
    for _ in range(20):
        uploading = page.locator(".media-modal .uploading").count()
        if uploading == 0:
            break
        page.wait_for_timeout(1000)

    click_first(
        page,
        [f".media-modal .media-button-select:has-text('{txt}')" for txt in select_button_texts]
        + [".media-modal .media-button-select"],
        timeout=15000,
    )
    page.wait_for_timeout(800)


def set_featured_image(page: Page, featured_image: str | None):
    if not featured_image:
        return
    open_media_modal(page, "#postimagediv")
    upload_media_and_confirm(page, [featured_image], ["Set product image", "设置产品图片"])


def set_gallery_images(page: Page, gallery_images: list[str]):
    if not gallery_images:
        return
    open_media_modal(page, "#woocommerce-product-images")
    upload_media_and_confirm(
        page,
        gallery_images,
        ["Add to gallery", "添加到相�?, "Set product image", "设置产品图片"],
    )


def save_product(page: Page, publish: bool):
    value = page.locator("#publish").input_value()
    is_publish_mode = value in ("发布", "Publish")
    if publish and is_publish_mode:
        page.click("#publish")
    elif publish and not is_publish_mode:
        page.click("#publish")
    elif not publish and is_publish_mode:
        page.click("#save-post")
    else:
        page.click("#publish")

    page.wait_for_load_state("domcontentloaded")
    page.wait_for_timeout(1200)


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Create WooCommerce product from wp-admin (classic editor) via Playwright."
    )
    parser.add_argument(
        "--spec",
        default=str(DEFAULT_SPEC_PATH),
        help="JSON file path of product spec.",
    )
    parser.add_argument(
        "--publish",
        action="store_true",
        help="Publish product immediately (default: save as draft/update).",
    )
    parser.add_argument(
        "--headed",
        action="store_true",
        help="Launch browser in headed mode.",
    )
    args = parser.parse_args()

    spec_path = Path(args.spec).resolve()
    if not spec_path.exists():
        raise RuntimeError(f"spec not found: {spec_path}")

    wp = load_wp_secrets()
    spec = load_spec(spec_path)

    featured_image = spec.get("featuredImage")
    gallery_images = spec.get("galleryImages", [])
    if featured_image:
        featured_image = str(Path(featured_image).resolve())
    gallery_images = [str(Path(p).resolve()) for p in gallery_images]

    report: dict[str, Any] = {
        "startedAt": time.strftime("%Y-%m-%dT%H:%M:%S"),
        "spec": str(spec_path),
        "publishRequested": args.publish,
        "created": False,
        "productEditUrl": "",
        "productViewUrl": "",
    }

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=not args.headed)
        context = browser.new_context()
        page = context.new_page()

        admin_url = wp["adminUrl"].rstrip("/")
        page.goto(f"{admin_url}/wp-admin", wait_until="domcontentloaded")
        maybe_login(page, wp)
        goto_product_editor(page, admin_url)

        wait_visible(page, ["#title"], timeout=15000)

        fill_basic_fields(page, spec)
        fill_product_data(page, spec)
        select_categories(page, spec.get("categories", []))
        set_featured_image(page, featured_image)
        set_gallery_images(page, gallery_images)
        save_product(page, publish=args.publish)

        report["created"] = True
        report["productEditUrl"] = page.url
        view_link = page.locator("#view-post-btn a, #sample-permalink a").first
        if view_link.count():
            try:
                report["productViewUrl"] = view_link.get_attribute("href") or ""
            except PlaywrightTimeoutError:
                report["productViewUrl"] = ""

        context.close()
        browser.close()

    REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
    REPORT_PATH.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"[wp-create-product-playwright] created={report['created']}")
    print(f"[wp-create-product-playwright] edit={report['productEditUrl']}")
    print(f"[wp-create-product-playwright] view={report['productViewUrl']}")
    print(f"[wp-create-product-playwright] report={REPORT_PATH}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
