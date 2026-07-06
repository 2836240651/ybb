# OMC Scroll Reveal Audit

> Generated: 2026-06-23  
> Script: `scripts/audit-omc-scroll-reveal.mjs`  
> JSON: `scripts/omc-scroll-reveal-audit.json`

## data-animate type counts (max per scroll position)

| Type | Count |
|------|-------|
| `fade-up-large` | 24 |
| `fade-up` | 8 |
| `zoom-out` | 5 |

## Section scroll-into-view probe

_No target found_

## In-view animated samples (mid scroll)

- `fade-up-large` opacity=1 transform=none delay=—
- `fade-up-large` opacity=0.999931 transform=matrix(1, 0, 0, 1, 0, 0.00300865) delay=0

## CSS rules (sample)

```css
.pswp--click-to-zoom.pswp--zoom-allowed .pswp__img { cursor: zoom-in; }
.pswp--no-mouse-drag.pswp--zoomed-in .pswp__img, .pswp--no-mouse-drag.pswp--zoomed-in .pswp__img:active, .pswp__img { cursor: zoom-out; }
.text-left .split-words { justify-content: flex-start; }
.text-center .split-words { justify-content: center; }
.text-right .split-words { justify-content: flex-end; }
@media screen and (min-width: 768px) {
  .md\:text-left .split-words { justify-content: flex-start; }
  .md\:text-center .split-words { justify-content: center; }
  .md\:text-right .split-words { justify-content: flex-end; }
}
@media screen and (min-width: 1024px) {
  .lg\:text-left .split-words { justify-content: flex-start; }
  .lg\:text-center .split-words { justify-content: center; }
  .lg\:text-right .split-words { justify-content: flex-end; }
}
.split-words .word { display: inline-flex; line-height: 1; margin: -0.1em -0.05em; overflow: hidden; padding: 0.15em 0.05em; }
```

---

## YBB implementation (2026-06-23)

### OMC interaction model

| Element | `data-animate` | Enter motion | Duration | Easing |
|---------|----------------|--------------|----------|--------|
| Images / video / media | `zoom-out` | `scale(1.15)` → `scale(1)` | 1.3s | `cubic-bezier(0.16, 1, 0.3, 1)` |
| Section headings | `fade-up-large` | `translateY(3rem)` + opacity 0 → 1 | 1s | same |
| Body copy / labels | `fade-up` | `translateY(1.5rem)` + opacity 0 → 1 | 1s | same |

- Trigger: `IntersectionObserver` threshold **0.12**, rootMargin **`0px 0px -8% 0px`**
- Stagger: **80ms** per `staggerIndex`
- Visible class: `.scroll-reveal--visible` (OMC `.animated` on `animate-element`)

### Files

- `components/motion/ScrollReveal.tsx` — React wrapper
- `components/motion/ScrollRevealProvider.tsx` — global IO driver
- `lib/motion/scroll-reveal.ts` — tokens
- `app/globals.css` — `.scroll-reveal` styles
- Home / PDP / PLP components wired with `ScrollReveal`

