# OMC Announcement Bar Audit

Captured: 2026-06-23T02:43:36.623Z
Source: https://www.omctackle.com

## Desktop (1440px)

### Bar metrics
| Property | Value |
|----------|-------|
| Height | 48px |
| Font size | 13px |
| Background | rgba(0, 0, 0, 0) |
| Display | flex row |
| Overflow | hidden |

### Flex child order (left → right)
1. `scrolling-text scrolling-text--left flex items-center w-full` — w=819px left=48px svgs=16 links=12 — ""

### Marquee animation
| Property | Value |
|----------|-------|
| Class | `marquee with-dot h-full flex items-center shrink-0 whitespace-nowrap animated` |
| Animation | scrolling-left |
| Duration | 40s |
| Timing | linear |
| Overflow | visible |

### Social icons (12)
- SVG `FREE NEW OMC FC REEL WITH ORDERS OVER £5` href=/collections/new-arrivals left=-1380px
- SVG `NEW PB SPLASH CAMO SHORTS!` href=/products/pb-splash-camo-shorts left=-868px
- SVG `FREE SHIPPING ON ALL ORDERS OVER £60 - U` href=/pages/shipping left=-533px
- SVG `FREE NEW OMC FC REEL WITH ORDERS OVER £5` href=/collections/new-arrivals left=-68px
- SVG `NEW PB SPLASH CAMO SHORTS!` href=/products/pb-splash-camo-shorts left=444px
- SVG `FREE SHIPPING ON ALL ORDERS OVER £60 - U` href=/pages/shipping left=778px
- SVG `FREE NEW OMC FC REEL WITH ORDERS OVER £5` href=/collections/new-arrivals left=1243px
- SVG `NEW PB SPLASH CAMO SHORTS!` href=/products/pb-splash-camo-shorts left=1755px
- SVG `FREE SHIPPING ON ALL ORDERS OVER £60 - U` href=/pages/shipping left=2090px
- SVG `FREE NEW OMC FC REEL WITH ORDERS OVER £5` href=/collections/new-arrivals left=2555px
- SVG `NEW PB SPLASH CAMO SHORTS!` href=/products/pb-splash-camo-shorts left=3067px
- SVG `FREE SHIPPING ON ALL ORDERS OVER £60 - U` href=/pages/shipping left=3402px

### Localization / country
- Localization: `localization hidden lg:flex items-center h-full`
- Country: `not found`

## Mobile (390px)

| Property | Value |
|----------|-------|
| Bar height | 48px |
| Visible children | 1 |
| Social visible | 12 icons |

Mobile layout order:
- scrolling-text scrolling-text--left flex items-center w-full w=350

## Target ybb-site layout (desktop md+)

```
[ marquee flex-1 overflow-hidden ]  [ FB IG YT TT icons ]  [ 🌐 Language ▾ ]  [ 🏳 Country/Currency ▾ ]
```

Screenshots: `audit-screenshots/announcement-bar/`
