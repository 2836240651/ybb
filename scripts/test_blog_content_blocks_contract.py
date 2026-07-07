from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def read(rel: str) -> str:
    return (ROOT / rel).read_text(encoding="utf-8", errors="replace")


def assert_contains(text: str, needle: str, label: str) -> None:
    if needle not in text:
        raise AssertionError(f"{label}: expected {needle!r}")


def assert_not_contains(text: str, needle: str, label: str) -> None:
    if needle in text:
        raise AssertionError(f"{label}: did not expect {needle!r}")


def test_blog_sanitizer_has_content_block_helper() -> None:
    source = read("deploy/wp-content/mu-plugins/ybb-site-manager/includes/class-sanitize.php")
    assert_contains(source, "function ybb_sm_sanitize_blog_content_blocks", "blog content block sanitizer")
    assert_contains(source, "paragraph", "supported paragraph block")
    assert_contains(source, "mediaText", "supported media-text block")
    assert_contains(source, "checklist", "supported checklist block")
    assert_contains(source, "cta", "supported CTA block")
    assert_contains(source, "'contentBlocks' => ybb_sm_sanitize_blog_content_blocks", "article sanitizer stores blocks")


def test_blog_rest_includes_content_blocks_on_full_articles() -> None:
    source = read("deploy/wp-content/mu-plugins/ybb-site-manager/includes/modules/blog.php")
    function_index = source.index("function ybb_sm_blog_enabled_articles")
    function_block = source[function_index : function_index + 2600]
    assert_contains(function_block, "'contentBlocks' =>", "full blog REST articles")
    assert_contains(function_block, "ybb_sm_blog_public_blocks", "REST block resolver")


def test_latest_stories_cards_stay_body_free() -> None:
    source = read("deploy/wp-content/mu-plugins/ybb-site-manager/includes/modules/blog.php")
    function_index = source.index("function ybb_sm_blog_home_cards")
    function_block = source[function_index : function_index + 1400]
    assert_not_contains(function_block, "contentBlocks", "Latest Stories cards")
    assert_not_contains(function_block, "'content' =>", "Latest Stories cards")


def test_blog_admin_renders_article_panels_and_block_controls() -> None:
    source = read("deploy/wp-content/mu-plugins/ybb-site-manager/includes/admin/page.php")
    assert_contains(source, "function ybb_sm_admin_blog_block", "admin blog block renderer")
    assert_contains(source, "contentBlocks", "admin content block field names")
    assert_contains(source, "data-ybb-blog-block", "admin block wrapper")
    assert_contains(source, "Add paragraph block", "admin append paragraph block")
    assert_contains(source, "Add media/text block", "admin append media text block")


if __name__ == "__main__":
    tests = [
        test_blog_sanitizer_has_content_block_helper,
        test_blog_rest_includes_content_blocks_on_full_articles,
        test_latest_stories_cards_stay_body_free,
        test_blog_admin_renders_article_panels_and_block_controls,
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
