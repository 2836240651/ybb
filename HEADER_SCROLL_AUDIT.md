# OMC Header Layout & Scroll Audit

> Generated: 2026-06-23  
> Script: `scripts/audit-omc-header-scroll.mjs`  
> JSON: `scripts/omc-header-scroll-audit.json`

## Desktop layout (1440px)

| Zone | Measurement |
|------|-------------|
| Viewport | 1440px |
| Header height | 153px |
| Header padding | 12px 48px 56px 48px |
| Logo zone width | 175px |
| Logo has image | true |
| Nav link count | 232 |
| Nav center X | 1203px (viewport center 720px) |
| Nav centered in viewport | false |
| Utilities gap | normal |
| Layout mode | display=flex, justify=normal, grid=none |
| Grid 3-col | false |
| Flex justify-between | false |

### Nav labels
- Fathers Day GiftsFathers Day Gifts
- Fathers Day Gifts
- Gift Cards
- The Rod Squad
- View all Gifts
- All Fathers Day Gifts(24)
- View
- 
- Add to cart
- Tweakers Touch Me Up
- View
- 
- Add to cart
- Str!p Off - Fishing Line Stripper
- View
- 
- Add to cart
- LIMITED EDITION - Signed Bivvy Bumper
- View
- 
- Add to cart
- B8M8 Electronic Bait Grinder
- NewNew
- New Arrivals
- Bundle Deals
- Shop All New Arrivals
- All New Arrivals(51)
- View
- 
- Add to cart
- Cyproguard
- View
- 
- Small
- Medium
- Large
- XL
- 2XL
- 3XL
- 4XL
- PB Splash Camo Shorts
- View
- 
- Small
- Medium
- Large
- XL
- 2XL
- 3XL
- 4XL
- The PB Shacket Shirt
- View
- 
- Choose options
- Black Pearl Rod & Reel Combo Bundle
- Terminal TackleTerminal Tackle
- Best Sellers
- Terminal Tackle
- Ready Rigs
- Leads
- Rig Bundles
- View All Terminal Tackle
- All Best Sellers(140)
- View
- 
- Size 2 Barbed
- Size 4 Barbed
- Size 6 Barbed
- Size 8 Barbed
- Size 4 Barbless
- Size 6 Barbless
- Size 8 Barbless
- The Lock Hook
- View
- 
- Light
- Medium
- Heavy
- The Magic Twig - Lead Clip Version
- View
- 
- Choose options
- ARRA Swivel Lead
- Green
- Brown
- View
- 
- Choose options
- Inline Flat Pear Lead
- Green
- Brown
- BaitBait
- Bait
- iScream
- Paella
- Bait Bundles
- View All Bait
- All Bait(32)
- View
- 
- Add to cart
- The Drip iScream
- View
- 
- Add to cart
- The Drip Paella
- View
- 
- 1kg 18mm
- 1kg 14mm
- 1kg 10mm
- iScream Stabilised Boilies 1kg
- View
- 
- 1kg 18mm
- 1kg 14mm
- 1kg 10mm
- Paella Stabilised Boilies 1kg
- Rods & ReelsRods & Reels
- Rods
- Reels
- View All Rods & Reels
- All Rods(8)
- View
- 
- Choose options
- The Black Pearl Rod Range
- View
- 
- Choose options
- The Black Pearl Master Bundle
- View
- 
- Add to cart
- Heist Travel Rod
- View
- 
- OMC FC Feeder Fishing Bundle
- HardwareHardware
- Bankware
- Bivvies & Shelters
- Fish Care
- Luggage
- Accessories
- Shop Hardware
- All Bankware(8)
- View
- 
- Add to cart
- Lock Gate Butt Grips
- View
- 
- The Heist Rod Pod
- View
- 
- 2 Rod Slim (6" & 5")
- 2 Rod Std (8" & 7")
- 3 Rod Slim (9.5" & 7.5")
- 3 Rod Std (11.5" & 9.5")
- Elbowz Black Anodised Aluminium (Pair)
- View
- 
- 2 Rod Slim (6" & 5")
- 2 Rod Std (8" & 7")
- 3 Rod Std (11.5" & 9.5")
- 3 Rod Wide (13.5" & 11.5")
- Elbowz High-Grade 316 Stainless Steel (P
- ClothingClothing
- Clothing
- Footwear
- Accessories
- Shop all Clothing
- All Clothing(42)
- View
- 
- Small
- Medium
- Large
- XL
- 2XL
- 3XL
- 4XL
- PB Splash Camo Shorts
- View
- 
- Small
- Medium
- Large
- XL
- 2XL
- 3XL
- 4XL
- The PB Shacket Shirt
- View
- 
- XS
- S
- M
- L
- XL
- 2XL
- 3XL
- Zerofit ICESKIN Cooling Summer Baselayer
- View
- 
- S
- M
- L
- XL
- XXL
- Zerofit ICESKIN Cooling Summer Leggings 
- OMC FCOMC FC
- OMC FC Combos
- OMC FC Kits
- OMC FC Bundles
- Shop all OMC FC
- All OMC FC Combos(5)
- View
- 
- Add to cart
- OMC FC Feeder Rod & Reel Combo
- View
- 
- Add to cart
- OMC FC Float Rod & Reel Combo
- View
- 
- OMC FC Net & Mat Combo
- View
- 
- Add to cart
- OMC FC Lure Combo

### Utility buttons (icon-only?)
鈥?
## Scroll hide behavior

| Property | Value |
|----------|-------|
| Trigger | **Direction-based** after **~300vh** scrollY; reveal on scroll up or when scrollY 鈮?50px |
| OMC classes @ hidden | `header-scrolled header-nav-scrolled header-hidden` on sticky section |
| Animation target | Inner `<header.header>` (not sticky section wrapper) |
| Transition | `opacity 0.5s cubic-bezier(0.6, 0, 0.4, 1), transform 0.5s cubic-bezier(0.6, 0, 0.4, 1)` |
| Hidden transform | `translateY(-162px)` (~full header height) |
| Hidden opacity (computed) | `1` 鈥?OMC relies on slide-up; YBB adds **opacity 0** fade per product spec |
| Announcement bar | **Separate** 鈥?scrolls off naturally (`top` negative), opacity stays 1, not tied to header-hidden |

### YBB implementation (2026-06-23)

- `hooks/useHeaderScroll.ts`: hide when `scrollY 鈮?300vh` + scrolling down; show on scroll up or `scrollY 鈮?50`
- `globals.css`: `.site-header-sticky--hidden .site-header` 鈫?`opacity: 0` + `translateY(-100%)`, `pointer-events: none`
- `Header.tsx`: skip hide class while mega menu open (`!activeMenu`)

### Scroll samples (top / transform)

| scrollY | header top | header transform | section class (snippet) |
|---------|------------|------------------|-------------------------|
| 0 | 48 | none | shopify-section shopify-section-group-header-group header-se |
| 50 | 0 | none | shopify-section shopify-section-group-header-group header-se |
| 100 | 0 | none | shopify-section shopify-section-group-header-group header-se |
| 150 | 0 | none | shopify-section shopify-section-group-header-group header-se |
| 200 | 0 | none | shopify-section shopify-section-group-header-group header-se |
| 300 | 0 | none | shopify-section shopify-section-group-header-group header-se |
| 500 | -162 | matrix(1, 0, 0, 1, 0, -161.723) | shopify-section shopify-section-group-header-group header-se |
| 800 | -162 | matrix(1, 0, 0, 1, 0, -161.723) | shopify-section shopify-section-group-header-group header-se |

### Scroll down (y鈮?00) vs scroll up (y鈮?00)

- **Down**: top=0, transform=none, classes=`shopify-section shopify-section-group-header-group header-section header-sticky `
- **Up**: top=0, transform=none, classes=`shopify-section shopify-section-group-header-group header-section header-sticky`

### Announcement bar on scroll

- scrollY=0: announcement top=0, opacity=1
- scrollY=300: announcement top=-300, opacity=1

## Classes observed

鈥?
