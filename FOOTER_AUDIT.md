# OMC Footer Audit

> Generated: 2026-06-23  
> Script: `scripts/audit-omc-footer.mjs`  
> JSON: `scripts/omc-footer-audit.json`  
> Screenshots: `audit-screenshots/footer/`

## Desktop measurements (1440px)


- Footer: 1440×818px, bg `rgba(0, 0, 0, 0)`
- Grid: `672px 672px`, 2 columns [672, 672]
- Headings: Quick links | OMC SIGN UP
- Newsletter: "OMC SIGN UP" — input 0px, radius 0px
- Social: 4 icons
- Payment: 0 icons
- Copyright: 14px


## Mobile measurements (390px)


- Columns: 2
- Footer height: 1134px


## Gap table (OMC vs ybb before rebuild)

| Area | OMC desktop | ybb (before) | Gap |
|------|-------------|--------------|-----|
| Footer background | rgba(0, 0, 0, 0) | rgb(23, 23, 23) dark | verify |
| Footer height | 818px | ~200px (3-col only) | missing logo/social/bottom |
| Main grid columns | 672px 672px | 3-col md:grid-cols-3 | need 4-col + logo |
| Column widths | 672, 672 | equal thirds | proportions |
| Blocks padding | 0px 48px 0px 48px | py-10 md:py-16 | match OMC |
| Blocks gap | normal | md:gap-12 | match OMC |
| Column heading size | 16px | text-sm uppercase | match |
| Link font size | 13px | text-sm | match |
| Newsletter input height | 0 | min-h-44px | match |
| Newsletter input radius | 0px | rounded-input | match |
| Newsletter button | 3.35544e+07px | rounded-button pill | circle arrow btn |
| Social icon count | 4 | 0 in footer | missing |
| Social icon size | 24 | — | add |
| Payment icon count | 0 | 8 text badges | need SVG row |
| Payment icon height | undefined | h-7 text | 24px SVG |
| Bottom bar border | 0px none rgb(255, 255, 255) | border-white/10 | match |
| Copyright font | 14px | text-sm center | text-xs left row |
| Link hover | background-size underline | .interaction-footer-link | aligned |
| Mobile columns | 2 | accordion 3-col | accordion OK |

## Quick links (OMC)

- ONE MORE CAST
- TERMINAL TACKLE
- RODS + REELS
- BAIT
- ACCESSORIES
- CLOTHING
- RIG BUNDLES
- E-VOUCHERS
- FISHING ARTICLES & VIDEOS
- SHIPPING
- RETURNS
- TERMS & CONDITIONS

## Information links (OMC)

—

## Payment brands (OMC)

—

## YBB implementation (2026-06-23)

### OMC footer structure @ 1440px (benchmark)

| Zone | Layout |
|------|--------|
| Main grid | 2 columns `672px 672px`, container padding `0 48px` |
| Left (`footer__left`) | Flex row, gap `~121px` (~7.578rem): **logo** + single **Quick links** column |
| Quick links | One heading only; nav + policy-style links in one vertical list (no separate Information column) |
| Right (`footer__right`) | Newsletter + social, horizontal padding `~121px` |
| Bottom bar | Copyright + policy links left; payment icons right |

### Changes made

| Task | Fix |
|------|-----|
| Merge Quick links + Information | Combined `quickLinks` + `information` into one `AccordionSection` titled "Quick links" |
| Duplicate headers | Removed second accordion/column (`footer.information` heading) |
| Logo alignment | Footer uses `page-container page-container-chrome` (`--header-padding-inline`) matching header inset |
| Logo component | Replaced custom `FooterBrandMark` SVG with shared `BrandLogo` (stacked icon + wordmark) |

### Files changed

- `components/layout/FooterColumns.tsx`
- `components/layout/Footer.tsx`
- `app/globals.css`
- `FOOTER_AUDIT.md`
