# Blog Content Blocks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build structured content blocks for YBB Site Manager Blog articles so article pages can render richer editorial layouts while Latest Stories cards stay lightweight.

**Architecture:** Add a sanitized `contentBlocks` field to each Site Manager blog article, expose it only through the full blog REST response, and render it through a focused React article-body component. Keep legacy `content` paragraphs as fallback and keep `/ybb/v1/latest-stories` card output unchanged.

**Tech Stack:** WordPress mu-plugin PHP, Next.js 15 React components, TypeScript types, existing Python source-contract tests, `npm run build`.

## Global Constraints

- Keep Latest Stories homepage cards lightweight and unchanged in behavior.
- Preserve existing articles and the current `content` paragraph fallback.
- No freeform WYSIWYG editor in version one.
- No native WordPress posts migration.
- No per-locale article body editing in version one.
- PHP/admin/REST changes remain in `deploy/wp-content/mu-plugins/ybb-site-manager/`.
- Next rendering changes require `npm run build` and `scripts/restart-dev.ps1` before reporting implementation complete.
- Do not revert unrelated dirty worktree changes.

---

## File Structure

- Modify `deploy/wp-content/mu-plugins/ybb-site-manager/includes/class-sanitize.php`: add `ybb_sm_sanitize_blog_content_blocks()` and preserve `contentBlocks` in sanitized article rows.
- Modify `deploy/wp-content/mu-plugins/ybb-site-manager/includes/modules/blog.php`: include enabled, resolved `contentBlocks` in full blog REST article output; keep home cards body-free.
- Modify `deploy/wp-content/mu-plugins/ybb-site-manager/includes/admin/page.php`: replace the cramped Blog article table with article panels and server-rendered content block fields.
- Modify `lib/site-manager/blog-api.ts`: add TypeScript union types for supported content blocks.
- Create `components/blog/BlogContentBlocks.tsx`: render supported blocks and legacy paragraph fallback.
- Modify `components/blog/BlogArticleView.tsx`: use `BlogContentBlocks` and skip empty hero image containers.
- Create or extend `scripts/test_blog_content_blocks_contract.py`: source-level tests for sanitizer, REST shape, home-card lightness, and frontend renderer wiring.
- Update `scripts/test_blog_realtime_contract.py` only if existing assertions need to include the new renderer without weakening current realtime safeguards.

---

### Task 1: Blog Content Block Sanitizer And REST Contract

**Files:**
- Create: `scripts/test_blog_content_blocks_contract.py`
- Modify: `deploy/wp-content/mu-plugins/ybb-site-manager/includes/class-sanitize.php`
- Modify: `deploy/wp-content/mu-plugins/ybb-site-manager/includes/modules/blog.php`

**Interfaces:**
- Produces PHP function:
  - `ybb_sm_sanitize_blog_content_blocks($input): array`
  - Returns an array of supported blocks with keys `id`, `type`, `enabled`, and type-specific fields.
- Produces REST article field:
  - `contentBlocks: array<int, array<string, mixed>>`
- Consumed later by:
  - `lib/site-manager/blog-api.ts` as `contentBlocks?: BlogContentBlock[]`
  - `components/blog/BlogContentBlocks.tsx`

- [ ] **Step 1: Write the failing source-contract test**

Add `scripts/test_blog_content_blocks_contract.py`:

```python
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


if __name__ == "__main__":
    tests = [
        test_blog_sanitizer_has_content_block_helper,
        test_blog_rest_includes_content_blocks_on_full_articles,
        test_latest_stories_cards_stay_body_free,
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
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```powershell
py scripts\test_blog_content_blocks_contract.py
```

Expected: FAIL on missing `function ybb_sm_sanitize_blog_content_blocks`.

- [ ] **Step 3: Implement sanitizer**

In `class-sanitize.php`, add helper functions before `ybb_sm_sanitize_blog()`:

```php
function ybb_sm_sanitize_blog_block_type(string $type): string
{
    $type = sanitize_key($type);
    $map = [
        'paragraph' => 'paragraph',
        'heading' => 'heading',
        'quote' => 'quote',
        'image' => 'image',
        'mediatext' => 'mediaText',
        'mediaText' => 'mediaText',
        'checklist' => 'checklist',
        'cta' => 'cta',
    ];

    return $map[$type] ?? '';
}

function ybb_sm_sanitize_blog_block_items($items): array
{
    if (is_string($items)) {
        $items = preg_split('/[\r\n]+/', $items) ?: [];
    }
    if (!is_array($items)) {
        return [];
    }

    $out = [];
    foreach ($items as $item) {
        $item = trim(sanitize_text_field((string) $item));
        if ($item !== '') {
            $out[] = $item;
        }
    }

    return $out;
}

function ybb_sm_sanitize_blog_content_blocks($input): array
{
    if (!is_array($input)) {
        return [];
    }

    $blocks = [];
    foreach (array_values($input) as $i => $row) {
        if (!is_array($row)) {
            continue;
        }
        $type = ybb_sm_sanitize_blog_block_type((string) ($row['type'] ?? ''));
        if ($type === '') {
            continue;
        }

        $block = [
            'id' => sanitize_key($row['id'] ?? ('block-' . ($i + 1))),
            'type' => $type,
            'enabled' => ybb_sm_parse_checkbox_enabled($row, 'enabled', true),
        ];

        if ($type === 'paragraph') {
            $block['text'] = sanitize_textarea_field((string) ($row['text'] ?? ''));
            if (trim($block['text']) === '') {
                continue;
            }
        } elseif ($type === 'heading') {
            $block['text'] = sanitize_text_field((string) ($row['text'] ?? ''));
            $level = sanitize_key((string) ($row['level'] ?? 'h2'));
            $block['level'] = in_array($level, ['h2', 'h3'], true) ? $level : 'h2';
            if ($block['text'] === '') {
                continue;
            }
        } elseif ($type === 'quote') {
            $block['text'] = sanitize_textarea_field((string) ($row['text'] ?? ''));
            $block['caption'] = sanitize_text_field((string) ($row['caption'] ?? ''));
            if (trim($block['text']) === '') {
                continue;
            }
        } elseif ($type === 'image') {
            $block['imageUrl'] = ybb_sm_sanitize_image_url((string) ($row['imageUrl'] ?? ''));
            $block['alt'] = sanitize_text_field((string) ($row['alt'] ?? ''));
            $block['caption'] = sanitize_text_field((string) ($row['caption'] ?? ''));
            $width = sanitize_key((string) ($row['width'] ?? 'wide'));
            $block['width'] = in_array($width, ['prose', 'wide'], true) ? $width : 'wide';
            if ($block['imageUrl'] === '') {
                continue;
            }
        } elseif ($type === 'mediaText') {
            $block['imageUrl'] = ybb_sm_sanitize_image_url((string) ($row['imageUrl'] ?? ''));
            $block['alt'] = sanitize_text_field((string) ($row['alt'] ?? ''));
            $block['eyebrow'] = sanitize_text_field((string) ($row['eyebrow'] ?? ''));
            $block['title'] = sanitize_text_field((string) ($row['title'] ?? ''));
            $block['text'] = sanitize_textarea_field((string) ($row['text'] ?? ''));
            $side = sanitize_key((string) ($row['imageSide'] ?? 'left'));
            $block['imageSide'] = in_array($side, ['left', 'right'], true) ? $side : 'left';
            if ($block['imageUrl'] === '' && $block['title'] === '' && trim($block['text']) === '') {
                continue;
            }
        } elseif ($type === 'checklist') {
            $block['title'] = sanitize_text_field((string) ($row['title'] ?? ''));
            $block['items'] = ybb_sm_sanitize_blog_block_items($row['items'] ?? []);
            if ($block['title'] === '' && $block['items'] === []) {
                continue;
            }
        } elseif ($type === 'cta') {
            $block['title'] = sanitize_text_field((string) ($row['title'] ?? ''));
            $block['text'] = sanitize_textarea_field((string) ($row['text'] ?? ''));
            $block['buttonLabel'] = sanitize_text_field((string) ($row['buttonLabel'] ?? ''));
            $block['href'] = ybb_sm_sanitize_href((string) ($row['href'] ?? ''));
            if ($block['title'] === '' && trim($block['text']) === '' && $block['buttonLabel'] === '') {
                continue;
            }
        }

        $blocks[] = $block;
    }

    return $blocks;
}
```

Then add this field to each sanitized article row:

```php
'contentBlocks' => ybb_sm_sanitize_blog_content_blocks($row['contentBlocks'] ?? []),
```

- [ ] **Step 4: Implement REST block resolver**

In `modules/blog.php`, add before `ybb_sm_blog_enabled_articles()`:

```php
function ybb_sm_blog_public_blocks(array $row): array
{
    $blocks = [];
    foreach ($row['contentBlocks'] ?? [] as $block) {
        if (!is_array($block) || empty($block['enabled'])) {
            continue;
        }
        if (isset($block['imageUrl'])) {
            $block['imageUrl'] = ybb_sm_blog_resolve_image_url((string) $block['imageUrl']);
        }
        $blocks[] = $block;
    }

    return $blocks;
}
```

Add this to the full article output in `ybb_sm_blog_enabled_articles()`:

```php
'contentBlocks' => ybb_sm_blog_public_blocks($row),
```

Do not add `contentBlocks` or `content` to `ybb_sm_blog_home_cards()`.

- [ ] **Step 5: Run tests and verify GREEN**

Run:

```powershell
py scripts\test_blog_content_blocks_contract.py
py scripts\test_blog_realtime_contract.py
```

Expected: all tests PASS.

- [ ] **Step 6: Commit Task 1**

Commit only task files:

```powershell
git add -- scripts\test_blog_content_blocks_contract.py deploy\wp-content\mu-plugins\ybb-site-manager\includes\class-sanitize.php deploy\wp-content\mu-plugins\ybb-site-manager\includes\modules\blog.php
git commit -m "feat: add blog content block contract"
```

---

### Task 2: Blog Admin Content Block Editor

**Files:**
- Modify: `deploy/wp-content/mu-plugins/ybb-site-manager/includes/admin/page.php`

**Interfaces:**
- Consumes:
  - `contentBlocks` array saved by Task 1.
  - Field names under `YBB_SM_OPTION[blog][articles][{articleIndex}][contentBlocks][{blockIndex}]`.
- Produces:
  - Server-rendered controls that submit block data compatible with `ybb_sm_sanitize_blog_content_blocks()`.

- [ ] **Step 1: Add failing source-contract assertions**

Extend `scripts/test_blog_content_blocks_contract.py` with:

```python
def test_blog_admin_renders_article_panels_and_block_controls() -> None:
    source = read("deploy/wp-content/mu-plugins/ybb-site-manager/includes/admin/page.php")
    assert_contains(source, "function ybb_sm_admin_blog_block", "admin blog block renderer")
    assert_contains(source, "contentBlocks", "admin content block field names")
    assert_contains(source, "data-ybb-blog-block", "admin block wrapper")
    assert_contains(source, "Add paragraph block", "admin append paragraph block")
    assert_contains(source, "Add media/text block", "admin append media text block")
```

Add `test_blog_admin_renders_article_panels_and_block_controls` to the `tests` list.

- [ ] **Step 2: Run the test and verify RED**

Run:

```powershell
py scripts\test_blog_content_blocks_contract.py
```

Expected: FAIL on missing `function ybb_sm_admin_blog_block`.

- [ ] **Step 3: Add admin block helper**

In `page.php`, add helper functions before `ybb_sm_admin_tab_blog()`:

```php
function ybb_sm_admin_blog_block(string $opt, int $articleIndex, int $blockIndex, array $block): void
{
    $base = $opt . '[blog][articles][' . $articleIndex . '][contentBlocks][' . $blockIndex . ']';
    $type = $block['type'] ?? 'paragraph';
    ?>
    <div class="postbox" data-ybb-blog-block style="padding:12px;margin:12px 0;border:1px solid #ccd0d4;">
        <input type="hidden" name="<?php echo esc_attr($base); ?>[id]" value="<?php echo esc_attr($block['id'] ?? ('block-' . ($blockIndex + 1))); ?>" />
        <p>
            <label>Enabled <?php ybb_sm_admin_enabled_checkbox($base . '[enabled]', !isset($block['enabled']) || !empty($block['enabled'])); ?></label>
            <label style="margin-left:12px;">Type
                <select name="<?php echo esc_attr($base); ?>[type]">
                    <?php foreach (['paragraph', 'heading', 'quote', 'image', 'mediaText', 'checklist', 'cta'] as $candidate) : ?>
                        <option value="<?php echo esc_attr($candidate); ?>" <?php selected($type, $candidate); ?>><?php echo esc_html($candidate); ?></option>
                    <?php endforeach; ?>
                </select>
            </label>
        </p>
        <p><label>Main text<br /><textarea class="large-text" rows="3" name="<?php echo esc_attr($base); ?>[text]"><?php echo esc_textarea($block['text'] ?? ''); ?></textarea></label></p>
        <p><label>Title / heading<br /><input type="text" class="large-text" name="<?php echo esc_attr($base); ?>[title]" value="<?php echo esc_attr($block['title'] ?? ''); ?>" /></label></p>
        <p>
            <label>Image URL<br />
                <input type="text" class="large-text ybb-sm-image" id="blog-block-img-<?php echo $articleIndex; ?>-<?php echo $blockIndex; ?>" name="<?php echo esc_attr($base); ?>[imageUrl]" value="<?php echo esc_attr($block['imageUrl'] ?? ''); ?>" />
            </label>
            <button type="button" class="button ybb-sm-pick-image" data-target="#blog-block-img-<?php echo $articleIndex; ?>-<?php echo $blockIndex; ?>">Pick image</button>
        </p>
        <p>
            <label>Alt <input type="text" name="<?php echo esc_attr($base); ?>[alt]" value="<?php echo esc_attr($block['alt'] ?? ''); ?>" /></label>
            <label style="margin-left:12px;">Caption <input type="text" name="<?php echo esc_attr($base); ?>[caption]" value="<?php echo esc_attr($block['caption'] ?? ''); ?>" /></label>
            <label style="margin-left:12px;">Eyebrow <input type="text" name="<?php echo esc_attr($base); ?>[eyebrow]" value="<?php echo esc_attr($block['eyebrow'] ?? ''); ?>" /></label>
        </p>
        <p>
            <label>Heading level
                <select name="<?php echo esc_attr($base); ?>[level]">
                    <option value="h2" <?php selected($block['level'] ?? 'h2', 'h2'); ?>>h2</option>
                    <option value="h3" <?php selected($block['level'] ?? 'h2', 'h3'); ?>>h3</option>
                </select>
            </label>
            <label style="margin-left:12px;">Image width
                <select name="<?php echo esc_attr($base); ?>[width]">
                    <option value="wide" <?php selected($block['width'] ?? 'wide', 'wide'); ?>>wide</option>
                    <option value="prose" <?php selected($block['width'] ?? 'wide', 'prose'); ?>>prose</option>
                </select>
            </label>
            <label style="margin-left:12px;">Image side
                <select name="<?php echo esc_attr($base); ?>[imageSide]">
                    <option value="left" <?php selected($block['imageSide'] ?? 'left', 'left'); ?>>left</option>
                    <option value="right" <?php selected($block['imageSide'] ?? 'left', 'right'); ?>>right</option>
                </select>
            </label>
        </p>
        <p><label>Checklist items<br /><textarea class="large-text" rows="3" name="<?php echo esc_attr($base); ?>[items]"><?php echo esc_textarea(implode("\n", (array) ($block['items'] ?? []))); ?></textarea></label></p>
        <p>
            <label>Button label <input type="text" name="<?php echo esc_attr($base); ?>[buttonLabel]" value="<?php echo esc_attr($block['buttonLabel'] ?? ''); ?>" /></label>
            <label style="margin-left:12px;">Href <input type="text" class="regular-text" name="<?php echo esc_attr($base); ?>[href]" value="<?php echo esc_attr($block['href'] ?? ''); ?>" /></label>
        </p>
    </div>
    <?php
}
```

- [ ] **Step 4: Replace article table with panels**

Inside `ybb_sm_admin_tab_blog()`, replace the wide article table with per-article panels. Preserve all existing metadata field names and add this section for blocks:

```php
<h4>Content blocks</h4>
<?php
$blocks = $row['contentBlocks'] ?? [];
if ($blocks === [] && !empty($row['content'])) {
    $blocks[] = ['id' => 'block-legacy-' . $i, 'type' => 'paragraph', 'enabled' => true, 'text' => implode("\n\n", (array) $row['content'])];
}
foreach ($blocks as $bi => $block) {
    ybb_sm_admin_blog_block($opt, $i, $bi, is_array($block) ? $block : []);
}
$next = count($blocks);
ybb_sm_admin_blog_block($opt, $i, $next, ['id' => 'block-new-paragraph-' . $i, 'type' => 'paragraph', 'enabled' => false]);
ybb_sm_admin_blog_block($opt, $i, $next + 1, ['id' => 'block-new-media-' . $i, 'type' => 'mediaText', 'enabled' => false]);
?>
<p class="description">Add paragraph block or Add media/text block by enabling the prepared block above, then save.</p>
```

Keep `contentText` as a legacy textarea below blocks:

```php
<p><label>Legacy paragraph fallback<br /><textarea name="<?php echo esc_attr($opt); ?>[blog][articles][<?php echo $i; ?>][contentText]" rows="4" class="large-text"><?php echo esc_textarea($contentText); ?></textarea></label></p>
```

- [ ] **Step 5: Run tests and verify GREEN**

Run:

```powershell
py scripts\test_blog_content_blocks_contract.py
```

Expected: PASS.

- [ ] **Step 6: Commit Task 2**

```powershell
git add -- scripts\test_blog_content_blocks_contract.py deploy\wp-content\mu-plugins\ybb-site-manager\includes\admin\page.php
git commit -m "feat: add blog content block admin fields"
```

---

### Task 3: Frontend Types And Article Renderer

**Files:**
- Create: `components/blog/BlogContentBlocks.tsx`
- Modify: `lib/site-manager/blog-api.ts`
- Modify: `components/blog/BlogArticleView.tsx`
- Modify: `scripts/test_blog_content_blocks_contract.py`

**Interfaces:**
- Consumes:
  - `BlogArticleApi.contentBlocks?: BlogContentBlock[]`
- Produces:
  - `BlogContentBlocks({ article }: { article: Pick<BlogArticleApi, "title" | "content" | "contentBlocks"> })`

- [ ] **Step 1: Add failing frontend source-contract tests**

Extend `scripts/test_blog_content_blocks_contract.py`:

```python
def test_frontend_types_and_renderer_are_wired() -> None:
    api = read("lib/site-manager/blog-api.ts")
    view = read("components/blog/BlogArticleView.tsx")
    renderer = read("components/blog/BlogContentBlocks.tsx")
    assert_contains(api, "export type BlogContentBlock", "blog API block type")
    assert_contains(api, "contentBlocks?: BlogContentBlock[]", "article block field")
    assert_contains(view, "BlogContentBlocks", "article view renderer import/use")
    assert_contains(view, "imageSrc ? (", "article hero only renders with image")
    assert_contains(renderer, "case \"mediaText\"", "media text renderer")
    assert_contains(renderer, "legacyParagraphs", "legacy fallback renderer")
```

Add the test to the `tests` list.

- [ ] **Step 2: Run the test and verify RED**

Run:

```powershell
py scripts\test_blog_content_blocks_contract.py
```

Expected: FAIL because `components/blog/BlogContentBlocks.tsx` does not exist.

- [ ] **Step 3: Add TypeScript block types**

In `lib/site-manager/blog-api.ts`, add:

```ts
export type BlogContentBlock =
  | { id: string; type: "paragraph"; enabled?: boolean; text: string }
  | { id: string; type: "heading"; enabled?: boolean; text: string; level?: "h2" | "h3" }
  | { id: string; type: "quote"; enabled?: boolean; text: string; caption?: string }
  | { id: string; type: "image"; enabled?: boolean; imageUrl: string; alt?: string; caption?: string; width?: "prose" | "wide" }
  | { id: string; type: "mediaText"; enabled?: boolean; imageUrl?: string; alt?: string; eyebrow?: string; title?: string; text?: string; imageSide?: "left" | "right" }
  | { id: string; type: "checklist"; enabled?: boolean; title?: string; items?: string[] }
  | { id: string; type: "cta"; enabled?: boolean; title?: string; text?: string; buttonLabel?: string; href?: string };
```

Add to `BlogArticleApi`:

```ts
contentBlocks?: BlogContentBlock[];
```

- [ ] **Step 4: Create `BlogContentBlocks.tsx`**

Create:

```tsx
"use client";

import Image from "next/image";
import Link from "next/link";
import type { BlogArticleApi, BlogContentBlock } from "@/lib/site-manager/blog-api";
import { blogArticleImageSrc } from "@/lib/site-manager/blog-api";
import { cn } from "@/lib/utils";

type ArticleBody = Pick<BlogArticleApi, "title" | "content" | "contentBlocks">;

function enabledBlocks(blocks: BlogContentBlock[] | undefined): BlogContentBlock[] {
  return (blocks ?? []).filter((block) => block.enabled !== false);
}

function blockImageSrc(src?: string): string {
  return blogArticleImageSrc({ imageUrl: src ?? "" });
}

function legacyParagraphs(article: ArticleBody) {
  return (
    <div className="mx-auto max-w-prose space-y-5 text-foreground/75 leading-relaxed">
      {article.content.map((para) => (
        <p key={para.slice(0, 48)}>{para}</p>
      ))}
    </div>
  );
}

function renderBlock(block: BlogContentBlock, articleTitle: string) {
  switch (block.type) {
    case "paragraph":
      return <p className="mx-auto max-w-prose text-foreground/75 leading-relaxed">{block.text}</p>;
    case "heading":
      return block.level === "h3" ? (
        <h3 className="mx-auto max-w-prose pt-4 text-2xl font-bold leading-tight">{block.text}</h3>
      ) : (
        <h2 className="mx-auto max-w-prose pt-6 text-3xl font-bold leading-tight">{block.text}</h2>
      );
    case "quote":
      return (
        <figure className="mx-auto max-w-3xl border-l-2 border-foreground bg-white/70 px-6 py-5">
          <blockquote className="text-2xl font-semibold leading-snug text-foreground">{block.text}</blockquote>
          {block.caption ? <figcaption className="mt-3 text-sm text-foreground/50">{block.caption}</figcaption> : null}
        </figure>
      );
    case "image": {
      const src = blockImageSrc(block.imageUrl);
      if (!src) return null;
      return (
        <figure className={cn("mx-auto", block.width === "prose" ? "max-w-prose" : "max-w-5xl")}>
          <div className="relative aspect-[16/9] overflow-hidden rounded-card bg-neutral-100">
            <Image src={src} alt={block.alt || articleTitle} fill sizes="(max-width: 1024px) 100vw, 1024px" className="object-cover" />
          </div>
          {block.caption ? <figcaption className="mt-2 text-sm text-foreground/50">{block.caption}</figcaption> : null}
        </figure>
      );
    }
    case "mediaText": {
      const src = blockImageSrc(block.imageUrl);
      return (
        <section className="mx-auto grid max-w-5xl gap-6 py-4 md:grid-cols-2 md:items-center">
          {src ? (
            <div className={cn("relative aspect-[4/3] overflow-hidden rounded-card bg-neutral-100", block.imageSide === "right" ? "md:order-2" : "")}>
              <Image src={src} alt={block.alt || block.title || articleTitle} fill sizes="(max-width: 768px) 100vw, 50vw" className="object-cover" />
            </div>
          ) : null}
          <div className="space-y-3">
            {block.eyebrow ? <p className="text-xs font-semibold uppercase text-foreground/50">{block.eyebrow}</p> : null}
            {block.title ? <h2 className="text-2xl font-bold leading-tight">{block.title}</h2> : null}
            {block.text ? <p className="text-foreground/70 leading-relaxed">{block.text}</p> : null}
          </div>
        </section>
      );
    }
    case "checklist":
      return (
        <section className="mx-auto max-w-3xl rounded-card border border-border bg-white p-6">
          {block.title ? <h2 className="mb-4 text-xl font-bold">{block.title}</h2> : null}
          <ul className="space-y-3 text-sm text-foreground/75">
            {(block.items ?? []).map((item) => (
              <li key={item} className="flex gap-3"><span aria-hidden="true">-</span><span>{item}</span></li>
            ))}
          </ul>
        </section>
      );
    case "cta":
      return (
        <section className="mx-auto max-w-4xl rounded-card bg-foreground p-6 text-background md:p-8">
          {block.title ? <h2 className="text-2xl font-bold">{block.title}</h2> : null}
          {block.text ? <p className="mt-3 max-w-2xl text-background/75">{block.text}</p> : null}
          {block.href && block.buttonLabel ? <Link href={block.href} className="mt-5 inline-flex rounded-full bg-background px-5 py-2 text-sm font-semibold text-foreground">{block.buttonLabel}</Link> : null}
        </section>
      );
  }
}

export function BlogContentBlocks({ article }: { article: ArticleBody }) {
  const blocks = enabledBlocks(article.contentBlocks);
  if (!blocks.length) {
    return legacyParagraphs(article);
  }

  return (
    <div className="space-y-8">
      {blocks.map((block) => (
        <div key={block.id}>{renderBlock(block, article.title)}</div>
      ))}
    </div>
  );
}
```

- [ ] **Step 5: Wire renderer and remove empty hero box**

In `BlogArticleView.tsx`:

```tsx
import { BlogContentBlocks } from "@/components/blog/BlogContentBlocks";
```

Replace the hero conditional with:

```tsx
{article && imageSrc ? (
  <div className="relative aspect-[21/9] max-w-4xl mb-12 rounded-card overflow-hidden bg-neutral-100">
    <Image
      src={imageSrc}
      alt={article.title}
      fill
      sizes="(max-width: 1024px) 100vw, 896px"
      className="object-cover"
      priority
    />
  </div>
) : null}
```

Replace the paragraph body with:

```tsx
{article ? (
  <BlogContentBlocks article={article} />
) : (
  <div className="max-w-prose space-y-5 text-foreground/75 leading-relaxed">
    <p>
      {ready
        ? "This story is managed in YBB Site Manager and is temporarily unavailable."
        : "Fetching the latest story from YBB Site Manager."}
    </p>
  </div>
)}
```

- [ ] **Step 6: Run tests and verify GREEN**

Run:

```powershell
py scripts\test_blog_content_blocks_contract.py
py scripts\test_blog_realtime_contract.py
```

Expected: all tests PASS.

- [ ] **Step 7: Commit Task 3**

```powershell
git add -- scripts\test_blog_content_blocks_contract.py lib\site-manager\blog-api.ts components\blog\BlogContentBlocks.tsx components\blog\BlogArticleView.tsx
git commit -m "feat: render blog content blocks"
```

---

### Task 4: Build Verification And Dev Server Restart

**Files:**
- Modify only if needed to fix build errors from Tasks 1-3.

**Interfaces:**
- Consumes all previous tasks.
- Produces verified local build and running dev server URL.

- [ ] **Step 1: Run contract tests**

```powershell
py scripts\test_blog_content_blocks_contract.py
py scripts\test_blog_realtime_contract.py
```

Expected: all tests PASS.

- [ ] **Step 2: Run Next build**

```powershell
npm run build
```

Expected: exit code 0. If TypeScript or lint fails, fix the referenced files and rerun the exact command.

- [ ] **Step 3: Restart dev server**

```powershell
powershell -ExecutionPolicy Bypass -File scripts\restart-dev.ps1
```

Expected: dev server starts on `http://localhost:3000` unless the script chooses another available port.

- [ ] **Step 4: Verify local article route**

```powershell
Invoke-WebRequest http://localhost:3000/blogs/news/2026-catalog-launch -UseBasicParsing
```

Expected: HTTP 200. If the route returns 500, inspect the dev server output, fix the build/runtime error, and rerun Steps 2-4.

- [ ] **Step 5: Commit verification fixes if any**

If Step 2 or Step 4 required code changes, stage the exact files reported by `git status --short` that were intentionally edited for this feature. The expected feature files are listed below; omit any file that was not touched.

```powershell
git add -- scripts\test_blog_content_blocks_contract.py deploy\wp-content\mu-plugins\ybb-site-manager\includes\class-sanitize.php deploy\wp-content\mu-plugins\ybb-site-manager\includes\modules\blog.php deploy\wp-content\mu-plugins\ybb-site-manager\includes\admin\page.php lib\site-manager\blog-api.ts components\blog\BlogContentBlocks.tsx components\blog\BlogArticleView.tsx
git commit -m "fix: stabilize blog content blocks build"
```

If no changes were needed, do not create an empty commit.

---

## Self-Review Notes

- Spec coverage: Tasks 1-3 cover sanitization, REST, admin editing, frontend rendering, legacy fallback, lightweight Latest Stories, and empty hero image behavior. Task 4 covers required build/dev verification.
- Placeholder scan: no task uses TBD/TODO/implement-later wording; each task has commands and expected results.
- Type consistency: PHP field name `contentBlocks` matches TypeScript `contentBlocks?: BlogContentBlock[]` and renderer input.
