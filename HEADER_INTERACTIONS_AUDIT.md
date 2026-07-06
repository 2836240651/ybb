# OMC Header Interactions Audit

> Generated: 2026-06-23  
> Script: `scripts/audit-omc-header-interactions.mjs`  
> JSON: `scripts/omc-header-interactions-audit.json`

## Nav pill (btn-duplicate)

| State | duplicate transform | text opacity |
|-------|---------------------|--------------|
| default | matrix(0.6, 0, 0, 0.6, 0, 42) | 1 |
| :hover | matrix(1, 0, 0, 1, 0, 0) | 0 |

## Icon hovers (::before fill)

| Icon | default ::before | hover ::before |
|------|------------------|----------------|
| Search | opacity —, transform — | opacity —, transform — |
| Cart | opacity 1 | opacity 1 |

## Mega menu enter (stagger samples)

- **+0ms**: panel opacity=1, sidebar opacity=0.766914, delay=0.6s, transform=matrix(1, 0, 0, 1, 22.7636, 0)
- **+200ms**: panel opacity=1, sidebar opacity=0.956791, delay=0.6s, transform=matrix(1, 0, 0, 1, 11.4951, 0)
- **+500ms**: panel opacity=1, sidebar opacity=0.99995, delay=0.6s, transform=matrix(1, 0, 0, 1, 3.00628, 0)
- **+1000ms**: panel opacity=1, sidebar opacity=1, delay=0.6s, transform=matrix(1, 0, 0, 1, 0.00571175, 0)

## Scroll hide

| Property | OMC measured |
|----------|--------------|
| Hide threshold (~transform) | 500px scrollY |
| 3× viewport (reference) | 2700px |
| Header transition | opacity 0.5s cubic-bezier(0.6, 0, 0.4, 1), transform 0.5s cubic-bezier(0.6, 0, 0.4, 1), padding-block-start 0.5s cubic-bezier(0.6, 0, 0.4, 1), padding-block-end 0.5s cubic-bezier(0.6, 0, 0.4, 1) |
| Hidden transform | matrix(1, 0, 0, 1, 0, -161.723) |
| Hidden opacity | 1 |

### Scroll samples

| scrollY | header transform | section classes (snippet) |
|---------|------------------|---------------------------|
| 0 | none | shopify-section shopify-section-group-header-group |
| 100 | none | shopify-section shopify-section-group-header-group |
| 300 | none | shopify-section shopify-section-group-header-group |
| 500 | matrix(1, 0, 0, 1, 0, -161.723) | shopify-section shopify-section-group-header-group |
| 1800 | matrix(1, 0, 0, 1, 0, -161.723) | shopify-section shopify-section-group-header-group |
| 2700 | matrix(1, 0, 0, 1, 0, -161.723) | shopify-section shopify-section-group-header-group |
| 3150 | matrix(1, 0, 0, 1, 0, -161.723) | shopify-section shopify-section-group-header-group |

### Reveal on scroll to top (opacity samples)

- +150ms: opacity=1, transform=matrix(1, 0, 0, 1, 0, -97.5592
- +300ms: opacity=1, transform=matrix(1, 0, 0, 1, 0, -5.5549)
- +450ms: opacity=1, transform=none
- +600ms: opacity=1, transform=none
- +750ms: opacity=1, transform=none
- +900ms: opacity=1, transform=none

---

## YBB audit — root causes & fixes (2026-06-23)

### Symptoms reported

All top-nav animations missing: nav pill slide, mega menu stagger, scroll fade, icon hovers.

### Playwright probe (localhost:3000 @ 1440px, post-fix)

| Interaction | Status | Notes |
|-------------|--------|-------|
| Nav pill hover | ✅ | duplicate `translateY(100%) scale(0.6)` → `translateY(0) scale(1)`; text fades out |
| Search icon `::before` fill | ✅ | `opacity 0 → 1`, color inverts to white |
| Mega menu open + stagger | ✅ | `mega-menu-content--visible`; sidebar `transition-delay: 0.4s` |
| Scroll hide @ 3.5×vh + reveal | ✅ | `opacity 0` + `translateY(-100%)`; reveal animates ~450ms |

### What broke each animation

| Animation | Root cause | Fix |
|-----------|------------|-----|
| **Nav pill slide** | Hover/focus selectors targeted `.nav-pill:hover` / `.nav-pill:focus-within` only; keyboard focus and parent `<a>`/`<button>` hover did not cascade to duplicate layer | Added `.nav-pill-trigger` on `NavPillLink`/`NavPillButton`; CSS uses `.nav-pill-trigger:hover` + `:focus-visible`; set `transition: none` on `.nav-pill` to block stray `transition: all` |
| **Mega menu enter** | Panel only toggled opacity/visibility — no `transform` enter | `.mega-menu-panel--closed` → `translateY(-8px)`; open → `translateY(0)` with `--animation-nav` |
| **Scroll hide fade** | `.site-header-sticky--hidden { pointer-events: none }` on **wrapper** blocked interactions in the sticky zone; looked like “dead” header | `pointer-events: none` only on `.site-header` when hidden; wrapper stays pass-through |
| **Icon hovers** | Working in CSS; mobile cart icon matched first in DOM probes (`lg:hidden` zone) | Desktop utilities use `.header-utilities-zone`; explicit `transition: color var(--animation-primary)` on `.header-utility-icon` |
| **Global “no motion”** | `@media (prefers-reduced-motion: reduce)` sets `transition-duration: 0.01ms !important` on `*` | Not a bug — verify OS **Settings → Accessibility → Visual effects** if animations appear instant |

### Scroll threshold: OMC vs YBB

| Source | Threshold |
|--------|-----------|
| OMC instant scroll probe (this audit) | Transform begins ~**500px** scrollY (sticky offset zone) |
| OMC direction-based hide (HEADER_SCROLL_AUDIT) | After **~300vh** scrollY + scrolling down; classes `header-nav-scrolled header-hidden` |
| YBB `useHeaderScroll.ts` | **300vh** (`MID_VIEWPORT_RATIO = 3.0`) + scroll direction; adds **opacity 0** fade (OMC keeps opacity 1, slide only) |

YBB intentionally keeps **300vh** per product spec; animation tokens match OMC: `0.5s cubic-bezier(0.6, 0, 0.4, 1)`.

### Files changed

- `scripts/audit-omc-header-interactions.mjs` — new OMC crawl (nav pill, icons, mega, scroll)
- `scripts/omc-header-interactions-audit.json` — crawl output
- `components/layout/NavPill.tsx` — `nav-pill-trigger` class on link/button wrappers
- `app/globals.css` — parent hover/focus selectors, mega panel transform, scroll hide pointer-events scope, utility icon transition
- `hooks/useHeaderScroll.ts` — exported threshold constants; sync on mount

### Verify

```powershell
Set-Location "D:\开发\fishAgent\总包\skill\reverse-skill\omc-replica\ybb-site"
node scripts/audit-omc-header-interactions.mjs
npm run build
powershell -ExecutionPolicy Bypass -File scripts/restart-dev.ps1
# http://localhost:3000 → 200
```
