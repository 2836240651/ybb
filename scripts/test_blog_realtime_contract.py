from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def read(rel: str) -> str:
    return (ROOT / rel).read_text(encoding="utf-8", errors="replace")


def assert_contains(text: str, needle: str, label: str) -> None:
    if needle not in text:
        raise AssertionError(f"{label}: expected to find {needle!r}")


def assert_not_contains(text: str, needle: str, label: str) -> None:
    if needle in text:
        raise AssertionError(f"{label}: did not expect to find {needle!r}")


def test_legacy_latest_stories_delegates_to_site_manager() -> None:
    source = read("deploy/wp-content/mu-plugins/ybb-home-settings.php")
    route_index = source.index("register_rest_route('ybb/v1', '/latest-stories'")
    route_block = source[route_index : route_index + 700]
    assert_contains(
        route_block,
        "ybb_sm_latest_stories_public",
        "legacy latest-stories REST route must delegate to Site Manager blog cards",
    )


def test_site_manager_home_cards_are_the_authoritative_story_source() -> None:
    source = read("deploy/wp-content/mu-plugins/ybb-site-manager/includes/modules/home.php")
    function_index = source.index("function ybb_sm_latest_stories_public")
    function_block = source[function_index : function_index + 1200]
    assert_contains(function_block, "ybb_sm_blog_home_cards", "latest stories must read blog cards")
    assert_contains(function_block, "'articles' => $articles", "latest stories must return blog cards")


def test_blog_views_do_not_seed_live_state_with_static_article_content() -> None:
    article = read("components/blog/BlogArticleView.tsx")
    index = read("components/blog/BlogIndexView.tsx")
    assert_not_contains(article, "useYbbBlog(fallbackResponse)", "article page live state")
    assert_not_contains(index, "useYbbBlog(fallbackResponse)", "blog index live state")
    assert_not_contains(article, "fallbackToResponse", "article page static content fallback")
    assert_not_contains(index, "fallbackToResponse", "blog index static content fallback")


def test_blog_routes_pass_static_fallback_props() -> None:
    article_page = read("app/blogs/[blog]/[article]/page.tsx")
    index_page = read("app/blogs/[blog]/page.tsx")
    assert_contains(index_page, "fallback={blog}", "blog index route")
    assert_contains(article_page, "fallbackBlog={blog}", "blog article route")
    assert_contains(article_page, "fallbackArticle=", "blog article route")


if __name__ == "__main__":
    tests = [
        test_legacy_latest_stories_delegates_to_site_manager,
        test_site_manager_home_cards_are_the_authoritative_story_source,
        test_blog_views_do_not_seed_live_state_with_static_article_content,
        test_blog_routes_pass_static_fallback_props,
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
