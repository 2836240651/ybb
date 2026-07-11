from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
TAB_BLOG = "deploy/wp-content/mu-plugins/ybb-site-manager/includes/admin/tab-blog.php"
SANITIZE = "deploy/wp-content/mu-plugins/ybb-site-manager/includes/class-sanitize.php"
MAIN_PLUGIN = "deploy/wp-content/mu-plugins/ybb-site-manager/ybb-site-manager.php"
PAGE = "deploy/wp-content/mu-plugins/ybb-site-manager/includes/admin/page.php"


def read(rel: str) -> str:
    return (ROOT / rel).read_text(encoding="utf-8", errors="replace")


def assert_contains(text: str, needle: str, label: str) -> None:
    if needle not in text:
        raise AssertionError(f"{label}: expected {needle!r}")


def assert_not_contains(text: str, needle: str, label: str) -> None:
    if needle in text:
        raise AssertionError(f"{label}: did not expect {needle!r}")


def test_tab_blog_module_exists() -> None:
    assert (ROOT / TAB_BLOG).is_file(), "tab-blog.php must exist"
    source = read(TAB_BLOG)
    assert_contains(source, "function ybb_sm_admin_tab_blog_router", "blog router")
    assert_contains(source, "function ybb_sm_admin_tab_blog_list", "blog list view")
    assert_contains(source, "function ybb_sm_admin_tab_blog_edit", "blog edit view")
    assert_contains(source, "function ybb_sm_admin_blog_block_fields", "blog block fields")


def test_page_wires_blog_router() -> None:
    source = read(PAGE)
    assert_contains(source, "ybb_sm_admin_tab_blog_router", "page blog router")
    assert_not_contains(source, "function ybb_sm_admin_tab_blog(", "legacy monolithic blog tab removed")
    assert_not_contains(source, "function ybb_sm_admin_blog_block(", "legacy blog block renderer removed")


def test_blog_save_modes_in_sanitizer() -> None:
    source = read(SANITIZE)
    assert_contains(source, "ybb_sm_sanitize_blog_list_partial", "list partial sanitizer")
    assert_contains(source, "ybb_sm_sanitize_blog_merge_article", "article merge sanitizer")
    assert_contains(source, "ybb_sm_sanitize_blog_article_row", "article row sanitizer")
    assert_contains(source, "ybb_sm_blog_save_mode", "save mode branch")


def test_blog_admin_assets_enqueued() -> None:
    source = read(MAIN_PLUGIN)
    assert_contains(source, "admin-blog.js", "blog admin js")
    assert_contains(source, "admin-blog.css", "blog admin css")
    assert_contains(source, "tab-blog.php", "tab-blog include")


def test_blog_admin_ux_controls() -> None:
    source = read(TAB_BLOG)
    assert_contains(source, "ybb_sm_blog_save_mode", "save mode hidden field")
    assert_contains(source, "data-ybb-blog-block", "block wrapper")
    assert_contains(source, "data-ybb-field", "type-aware fields")
    assert_contains(source, "ybb-blog-add-block", "add block button")
    assert_contains(source, "选择图片", "chinese pick image label")
    assert_not_contains(source, "Add paragraph block", "legacy placeholder hint removed")
    assert_not_contains(source, "enabled' => false", "disabled placeholder blocks removed")


def test_blog_admin_list_has_preview_and_edit() -> None:
    source = read(TAB_BLOG)
    assert_contains(source, "ybb_sm_admin_blog_preview_url", "preview url helper")
    assert_contains(source, "ybb_sm_admin_tab_blog_toolbar", "list toolbar")
    assert_contains(source, "首页轮播", "featured toggle label")


def test_blog_php_field_visibility_helpers() -> None:
    source = read(TAB_BLOG)
    assert_contains(source, "ybb_sm_admin_blog_field_visible", "php field visibility")
    assert_contains(source, "ybb_sm_admin_blog_field_class", "php field class helper")


if __name__ == "__main__":
    tests = [
        test_tab_blog_module_exists,
        test_page_wires_blog_router,
        test_blog_save_modes_in_sanitizer,
        test_blog_admin_assets_enqueued,
        test_blog_admin_ux_controls,
        test_blog_admin_list_has_preview_and_edit,
        test_blog_php_field_visibility_helpers,
    ]
    failures = 0
    for test in tests:
        try:
            test()
            print(f"PASS {test.__name__}")
        except Exception as exc:
            failures += 1
            print(f"FAIL {test.__name__}: {exc}")
    raise SystemExit(1 if failures else 0)
