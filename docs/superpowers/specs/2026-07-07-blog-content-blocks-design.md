# Blog Content Blocks Design

## Context

YBB Site Manager currently manages Latest Stories through the Blog tab. Each article has list/card metadata, a single cover image, and a `contentText` textarea that is sanitized into a `content: string[]` paragraph array. The homepage carousel reads lightweight story cards from `/ybb/v1/latest-stories`, while article detail pages read `/ybb/v1/site-manager/blog` at runtime.

This keeps the homepage fast and avoids static redeploys for article edits, but article detail pages can only render a cover image followed by plain paragraphs. The result is visually flat, and editors cannot insert inline images, highlighted callouts, CTA sections, or structured lists.

## Goals

- Give operators a richer article editing workflow inside `YBB Site Manager -> Blog`.
- Keep Latest Stories homepage cards lightweight and unchanged in behavior.
- Add reusable article content blocks that can be ordered, enabled, and rendered with polished YBB article layouts.
- Preserve existing articles and the current `content` paragraph fallback.
- Keep REST responses safe, sanitized, cache-busted, and compatible with the current runtime fetch model.

## Non-Goals

- Do not introduce a freeform WYSIWYG editor in the first version.
- Do not rebuild the blog as native WordPress posts.
- Do not change homepage Latest Stories card selection beyond continuing to use `featuredOnHome`.
- Do not add per-locale article body editing in the first version; the existing blog copy remains single-language unless a later i18n spec extends it.

## Recommended Approach

Use structured content blocks per article. Each block has a stable `id`, a `type`, an `enabled` flag, and type-specific fields. The admin UI exposes a repeatable block editor under each article. The REST payload exposes `contentBlocks` for rich rendering and continues to expose `content` for legacy paragraph consumers.

The article page renders `contentBlocks` when present. If an article has no enabled blocks, it renders the existing `content` paragraphs. The homepage carousel still receives only card fields: `handle`, `title`, `excerpt`, `publishedAt`, `image`, and `href`.

## Content Block Types

### Paragraph

Purpose: normal prose.

Fields:

- `text`

Rendering: constrained prose width, relaxed line height, consistent paragraph spacing.

### Heading

Purpose: section breaks inside an article.

Fields:

- `text`
- `level`: `h2` or `h3`

Rendering: strong typographic rhythm with anchor-free headings.

### Quote

Purpose: highlight a key sentence or catalog/customer note.

Fields:

- `text`
- `caption`

Rendering: full-width or slightly wider-than-prose callout with border/accent treatment.

### Image

Purpose: inline visual proof, catalog page, product detail, factory shot, or lifestyle image.

Fields:

- `imageUrl`
- `alt`
- `caption`
- `width`: `prose` or `wide`

Rendering: stable aspect container, object-cover image, optional caption. Missing image URL renders no image block.

### Media Text

Purpose: more dynamic editorial rhythm: image next to copy.

Fields:

- `imageUrl`
- `alt`
- `eyebrow`
- `title`
- `text`
- `imageSide`: `left` or `right`

Rendering: two-column desktop layout, stacked mobile layout, with image/copy alternation.

### Checklist

Purpose: buyer steps, quality points, catalog notes, RFQ instructions.

Fields:

- `title`
- `items`: newline-separated items in admin, array in REST

Rendering: compact list with check-style markers and a quiet framed section.

### CTA

Purpose: convert article traffic into contact or catalog action.

Fields:

- `title`
- `text`
- `buttonLabel`
- `href`

Rendering: restrained B2B CTA band with one link button. Invalid or empty `href` hides the button but keeps text.

## Data Model

Article rows keep existing fields and add:

```json
{
  "contentBlocks": [
    {
      "id": "block-catalog-intro",
      "type": "quote",
      "enabled": true,
      "text": "Use the new catalog as a planning sheet before RFQ.",
      "caption": "YBB Sales Team"
    }
  ]
}
```

Sanitization rules:

- `type` must be one of the supported block types; unknown types are dropped.
- `enabled` defaults to true for existing or newly submitted blocks.
- Text fields use text/textarea sanitization.
- `imageUrl` uses the existing Site Manager image URL sanitizer.
- `href` accepts site-relative paths and `http(s)` URLs through the existing URL sanitizer pattern.
- Empty blocks are dropped.
- Existing `content` and `contentText` behavior remains unchanged.

REST shape:

```json
{
  "handle": "2026-catalog-launch",
  "title": "2026 Wholesale Catalog Now Available",
  "content": ["Legacy paragraph fallback."],
  "contentBlocks": [
    { "id": "block-1", "type": "paragraph", "enabled": true, "text": "..." }
  ]
}
```

## Admin UX

The current table layout is too cramped for rich article editing. Replace the article table body with article cards inside the Blog tab:

- Blog-level settings remain at the top.
- Each article appears as a bordered admin panel with metadata fields first.
- Each article panel includes a "Content blocks" section.
- Each block row has type, enabled, main fields, image picker where relevant, and move up/down controls.
- A small "Add block" selector appends a new block of the chosen type.
- The first implementation can use server-rendered PHP form rows and minimal admin JavaScript for adding/removing/reordering blocks.

This stays consistent with the existing mu-plugin settings form and avoids a separate React admin app.

## Frontend Rendering

`BlogArticleView.tsx` should delegate body rendering to a focused renderer, for example `BlogContentBlocks`.

Rules:

- Use `article.contentBlocks` when at least one enabled/supported block exists.
- Fall back to `article.content.map(...)` otherwise.
- Keep article header metadata and hero image separate from body blocks.
- Do not render an empty hero image container when the cover image is missing.
- Use stable responsive dimensions for images and text regions.
- Keep styles aligned with the existing YBB design system: restrained B2B editorial layout, no decorative blobs, no nested cards.

## Compatibility And Migration

No bulk migration is required.

- Existing articles continue to render from `content`.
- When an editor saves an old article without adding blocks, `content` remains the source.
- New or edited articles can use `contentBlocks`.
- Optionally, the admin can show a helper action to convert current paragraphs into paragraph blocks, but this is not required for version one.

## Testing

Add or update focused tests for:

- Sanitizer keeps existing `content` behavior.
- Sanitizer accepts supported block types and drops unknown/empty blocks.
- Blog REST includes `contentBlocks`.
- Latest Stories legacy endpoint still delegates to Site Manager home cards and does not include heavy article body fields.
- Article view still does not seed runtime state with static article content.
- Article renderer falls back to legacy paragraphs when blocks are absent.

Manual verification:

- Blog REST returns cache-busted fresh data through `index.php?rest_route=/ybb/v1/site-manager/blog&_={timestamp}`.
- A rich article renders paragraph, heading, quote, image, media-text, checklist, and CTA blocks.
- An old article still renders paragraphs.
- Homepage Latest Stories carousel remains unchanged.

## Deployment Notes

This feature touches both the mu-plugin and Next frontend:

- PHP/admin/REST changes require uploading `ybb-site-manager` through the approved SiteGround File Manager mu-plugin path, then immediately verifying REST with a cache-busted curl.
- Next rendering changes require local build, source sync to the Ubuntu deploy machine, remote build, runner/deploy, and post-deploy verification per `AGENTS.md`.
- Backend-only field additions are not enough; the frontend must be deployed before rich blocks visibly render on article pages.

## Acceptance Criteria

- Operators can create and reorder rich content blocks for Blog articles in YBB Site Manager.
- `/ybb/v1/site-manager/blog` returns sanitized `contentBlocks` per article.
- `/ybb/v1/latest-stories` remains lightweight and compatible with the homepage carousel.
- Article pages render enabled blocks with richer editorial layouts and preserve legacy paragraph fallback.
- Missing article cover images no longer create a large blank hero image box.
- Existing blog realtime contract tests pass, with new tests covering block behavior.
