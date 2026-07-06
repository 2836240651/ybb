# Hero Carousel Audit — OMC vs YBB

> **Generated**: 2026-06-23  
> **Script**: `scripts/audit-omc-hero.mjs`  
> **Benchmark**: https://www.omctackle.com  
> **Raw data**: `scripts/omc-hero-audit.json`  
> **Screenshots**: `audit-screenshots/hero/`

---

## 1. OMC crawl measurements (@ 1440px)

| Property | OMC measured |
|----------|--------------|
| Autoplay | `7s` (`autoplay-speed="7"`) |
| Transition | Flickity horizontal ~700ms (`--animation-smooth`) |
| Slide count | 5 |
| Active slide size | 1344×638px (content width inside `gap-padding`) |
| Border radius | ~15px (`--rounded-block` / `--rounded-card`) |
| Slide gap | 30px (`margin-right` between cells) |
| Adjacent peek | ~18px of next slide visible in right gutter |
| Overlay gradient | `linear-gradient(180deg, rgb(0 0 0 / 0.3) 50%, rgb(0 0 0 / 1) 100%)` on `.slideshow .banner__overlay` |
| Heading class | `.heading.title-sm` → **36.37px**, weight 700, line-height 1 |
| Heading align | center, bottom ~83px above slide bottom |
| Heading transform | none (content is uppercase in source) |
| Dot hit area | 24×24px (`--sp-6`) |
| Dot active | 5px inner ring via `box-shadow: 0 0 0 2px` |
| Prev/Next | 32×32px, bottom corners inside `page-width` padding |
| Controls padding | `0 48px` (`--gap-padding` @ desktop) |

### Mobile (@ 390px)

| Property | Value |
|----------|-------|
| Slide height | 500px |
| Horizontal inset | `gap-padding` clamp |

### Per-slide copy (OMC)

| Slide | Headline |
|-------|----------|
| 1 | (CTA-only slide) |
| 2 | (CTA-only slide) |
| 3 | PB SHACKET SHIRT |
| 4 | FREE REEL WITH ORDERS OVER £50 |
| 5 | — |

---

## 2. YBB gaps (before fix)

| Issue | YBB (wrong) | OMC (target) |
|-------|-------------|--------------|
| Text layout | Left column: eyebrow + `text-title-xl` H2 + subtitle + pill CTA | Centered bottom caption, **single headline** via `slideshow-words` |
| Gradient | `bg-gradient-to-r from-black/70` full overlay + section bottom fade | Per-slide `.banner__overlay` bottom-weighted gradient only |
| Typography | `text-title-xl` (up to 80px) | `text-title-sm` / `text-hero-caption` (~36px @ 1440) |
| Carousel layout | `basis-full` inside padded box, no inter-slide gap | `calc(100% - 2×gap-padding)` slide + 30px gap + right peek |
| Dots | Pill bar (7×1.5px active) | 24px ring dot (5px core + 2px ring when selected) |
| Arrows | 40px blurred dark circles | 32px minimal white icons at bottom corners |

---

## 3. YBB implementation (after fix)

| OMC | YBB mapping |
|-----|-------------|
| Flickity + 7s autoplay | Embla `autoplayDelay: 7000`, `duration: 35` |
| `.slideshow .banner__overlay` gradient | `.hero-banner__overlay` + `--hero-overlay-opacity: 0.3` |
| `.heading.title-sm` | `@utility text-hero-caption` (`--title-sm`) |
| `slideshow-words` synced caption | `HeroAnimatedCaption` with word-stagger fade-up-large |
| Slide gap 30px + peek | `basis-[calc(100%-var(--gap-padding)*2)]` + `mr-[var(--hero-slide-gap)]` |
| `flickity-page-dot` ring | `.hero-dot__inner` ring on active |
| 32px corner arrows | `h-8 w-8` icon buttons, `hidden md:flex` |
| Full-slide link | `<Link className="absolute inset-0">` per slide |
| 500px / 638px heights | `h-[500px] md:h-[638px]` |

### Files changed

- `components/home/HeroCarousel.tsx` — layout, caption, nav, peek slides
- `app/globals.css` — `--hero-overlay-opacity`, `--hero-caption-offset`, `text-hero-caption`, `.hero-banner__overlay`
- `lib/i18n/dictionaries/{en,zh,ja}.json` — single `title` per slide (B2B copy retained)
- `scripts/audit-omc-hero.mjs` — new crawl script
- `scripts/omc-hero-audit.json` — raw measurements

### Before / after

**Before:** Left-aligned editorial hero — small eyebrow, oversized multi-line heading, body copy, pill CTA, heavy left-to-right dark wash across the full image.

**After:** OMC-style promo carousel — rounded slide cards with 30px gap and slight right peek, bottom-only gradient on the active slide, one centered uppercase headline with word-stagger fade animation on slide change, minimal 32px corner arrows and ring dots along the bottom edge.

---

## 4. Caption animation (OMC `slideshow-words`)

> **Crawl**: `scripts/audit-omc-hero-caption.mjs` → `scripts/omc-hero-caption-animation.json`

### OMC pattern

| Step | Behavior |
|------|----------|
| Engine | `SlideshowWords` listens to `slider:change`, updates `selected-index` |
| Text split | `split-words` → per-word `animate-element[data-animate=fade-up-large]` |
| Exit | `reset()` → `translateY(-90%)` + `opacity: 0`, **1s**, stagger **30ms**/word |
| Switch delay | **500ms + 30ms × wordCount** before `aria-current` flips |
| Enter | `refresh()` → `translateY(90%)` → `0`, **1s**, base **250ms** + **30ms**/word |
| Easing | `cubic-bezier(0.16, 1, 0.3, 1)` |

### YBB mapping

| OMC | YBB |
|-----|-----|
| `slideshow-words` stack | `.hero-banner__captions` grid + per-slide `<h2>` |
| `aria-current` toggle | `displayIndex` state + `--hidden` class |
| `fade-up-large` | `@keyframes hero-caption-fade-up-in/out` |
| Switch timing | `500ms + 30ms × words` (exit), then enter |
| Reduced motion | `usePrefersReducedMotion()` → instant swap |

---

## 5. Re-run audit

```powershell
Set-Location "D:\开发\fishAgent\总包\skill\reverse-skill\omc-replica\ybb-site"
node scripts/audit-omc-hero.mjs
node scripts/audit-omc-hero-caption.mjs
```
