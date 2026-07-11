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
    assert_contains(source, "sortOrder", "sortable content blocks")
    assert_contains(source, "usort($blocks", "content block sorting")
    assert_contains(source, "$row['text'] ?? ($row['title'] ?? '')", "heading title fallback")
    assert_contains(source, "'contentBlocks' => $contentBlocks", "article row stores blocks")
    assert_contains(source, "ybb_sm_sanitize_blog_content_blocks", "article row uses block sanitizer")


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
    source = read("deploy/wp-content/mu-plugins/ybb-site-manager/includes/admin/tab-blog.php")
    assert_contains(source, "function ybb_sm_admin_blog_block_fields", "admin blog block renderer")
    assert_contains(source, "contentBlocks", "admin content block field names")
    assert_contains(source, "data-ybb-blog-block", "admin block wrapper")
    assert_contains(source, "ybb-blog-add-block", "admin add block control")
    assert_contains(source, "data-ybb-field", "type-aware admin fields")


def test_frontend_types_and_renderer_are_wired() -> None:
    api = read("lib/site-manager/blog-api.ts")
    view = read("components/blog/BlogArticleView.tsx")
    renderer = read("components/blog/BlogContentBlocks.tsx")
    assert_contains(api, "export type BlogContentBlock", "blog API block type")
    assert_contains(api, "contentBlocks?: BlogContentBlock[]", "article block field")
    assert_contains(view, "BlogContentBlocks", "article view renderer import/use")
    assert_contains(view, "showHero", "article hero dedupe gate")
    assert_contains(renderer, 'case "mediaText"', "media text renderer")
    assert_contains(renderer, "legacyParagraphs", "legacy fallback renderer")
    assert_contains(renderer, "sortOrder", "content block sort order")
    assert_contains(renderer, "articleHeroDuplicatesFirstMediaBlock", "hero dedupe helper")


def test_blog_article_chrome_has_no_replacement_characters() -> None:
    view = read("components/blog/BlogArticleView.tsx")
    assert_not_contains(view, "\ufffd", "blog article chrome text")


def test_blog_remote_images_render_as_plain_img_elements() -> None:
    view = read("components/blog/BlogArticleView.tsx")
    renderer = read("components/blog/BlogContentBlocks.tsx")
    assert_not_contains(view, 'from "next/image"', "article hero image renderer")
    assert_not_contains(renderer, 'from "next/image"', "article block image renderer")
    assert_contains(view, "<img", "article hero image renderer")
    assert_contains(renderer, "<img", "article block image renderer")


def test_blog_image_helper_preserves_absolute_https_urls() -> None:
    api = read("lib/site-manager/blog-api.ts")
    assert_contains(api, 'raw.startsWith("https://")', "blog image URL normalizer")


if __name__ == "__main__":
    tests = [
        test_blog_sanitizer_has_content_block_helper,
        test_blog_rest_includes_content_blocks_on_full_articles,
        test_latest_stories_cards_stay_body_free,
        test_blog_admin_renders_article_panels_and_block_controls,
        test_frontend_types_and_renderer_are_wired,
        test_blog_article_chrome_has_no_replacement_characters,
        test_blog_remote_images_render_as_plain_img_elements,
        test_blog_image_helper_preserves_absolute_https_urls,
    ]
    failures = 0
    for test in tests:
        try:
            test()
            print(f"PASS {test.__name__}")
        except Exception as exc:
            failures += 1
            print(f"FAIL {test.__name__}: {ascii(str(exc))}")
    raise SystemExit(1 if failures else 0)
