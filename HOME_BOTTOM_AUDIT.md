# OMC Homepage Bottom Audit

> Generated: 2026-06-23  
> Script: `scripts/audit-omc-home-bottom.mjs`  
> JSON: `scripts/omc-home-bottom-audit.json`  
> Screenshots: `audit-screenshots/home-bottom/`

## Target section order (OMC tail)

1. **Latest Stories** — blog carousel (date, title, Read more, arrows, View all)
2. **Service bar** — 4 columns: shipping, support, payment, articles (light gray, dividers)
3. **Recently viewed** — product image carousel with SOLD OUT badges

## Desktop measurements (1440px)


- Bottom headings: Latest Stories
- Latest Stories: "Latest Stories" — 0 cards, 0 arrow buttons
- Service bar: 6 items — Fast Free ShippingGet free UK shipping on order £60 · Fast Free ShippingGet free UK shipping on order £60 · Fast Free Shipping · Get free UK shipping on order £60 · Customer serviceIndustry-leading customer service - from anglers who care. Click Here
- Service bg: `rgba(0, 0, 0, 0)`, padding `0px 0px 0px 0px`
- Recently viewed: "undefined" — 0 cards, 0 sold out


## Mobile (390px)


- Latest Stories cards: 0
- Service items: 6
- Recently viewed cards: 0


## Gap table (OMC vs ybb before rebuild)

| Area | OMC desktop | ybb (before) | Gap |
|------|-------------|----------------|-----|
| Bottom order | Latest Stories | Blog → TrustBadges (B2B) | rebuilt |
| Latest Stories heading | Latest Stories | Latest Stories | ✅ i18n 最近更新 |
| Blog card date + Read more | — + — | date + Read more | ✅ |
| Blog View all + arrows | arrows:0 viewAll:false | arrows + View all | ✅ |
| Service bar columns | 6 | 0 (TrustBadges B2B) | ✅ ServiceTrustBar |
| Service bar bg | rgba(0, 0, 0, 0) | neutral-50 sections | ✅ neutral-100 |
| Service labels | Fast Free ShippingGet free UK shipping on order £60 | Fast Free ShippingGet free UK shipping on order £60 | Fast Free Shipping | Get free UK shipping on order £60 | Factory & supply | ✅ OMC 4-col |
| Recently viewed heading | — | missing | ✅ RecentlyViewedCarousel |
| Recently viewed cards | 0 | 0 | ✅ image carousel |
| SOLD OUT badges | 0 | N/A | ✅ vertical badge |
