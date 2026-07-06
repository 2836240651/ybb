# OMC Mega Menu Audit

> Generated: 2026-06-23  
> Script: `scripts/audit-omc-mega-menu.mjs` (+ `omc-replica/scripts/probe-omc-mega-open.mjs`)  
> JSON: `scripts/omc-mega-menu-audit.json`  
> Benchmark: https://www.omctackle.com @ 1440×900

## Crawl summary (live OMC)

### DOM structure (all mega nav items)

| Zone | OMC selector / pattern | Notes |
|------|------------------------|-------|
| Panel | `details[is="details-mega"][open] .mega-menu` | Full-width below sticky header |
| Container | `.mega-menu__container` | `padding-top: 153px`, horizontal inset via theme `page-width` |
| Left sidebar | `.mega-menu__nav-item` links | Large bold collection names, opacity stagger on open |
| Sidebar heading | `p.uppercase` / first column label | **Collections** (Hardware) or **Collection** (Terminal Tackle) |
| Product header | Second column `p` label | **Most popular** on live site (screenshot benchmark: **Best Sellers**) |
| View-all | `All {Subcategory} (N) →` | Right-aligned in product header row |
| Shop-all | Bottom of sidebar + `border-top` | e.g. **Shop Hardware →** |
| Product grid | `.mega-menu__list > .mega-menu__item` | 4 cards, image + title + price row |
| Sold-out | Badge on image | Vertical **SOLD OUT** overlay |

### Per-nav probes

#### Hardware
| Sidebar items | Bankware · Bivvies & Shelters · Fish Care · Luggage · Accessories |
| Product cards | 4-up grid, price right-aligned, sold-out badge on at least one SKU |
| Panel height | ~680px |

#### Terminal Tackle
| Sidebar items | Best Sellers · Terminal Tackle · Ready Rigs · Leads · Rig Bundles |
| Section label | Most popular |
| First sidebar opacity | ~0.96 (active / emphasized) |

#### New
| Sidebar items | New Arrivals · Bundle Deals |
| Panel height | ~657px |

### Tab switching behavior

- Hovering a sidebar `.mega-menu__nav-item` **updates the product grid** without closing the drawer.
- Active item = highest opacity + bold foreground (first item default on open).
- Product cards re-stagger with `opacity` + `translateY` crossfade (~300ms panel switch, ~1s child stagger).

### Typography & motion tokens (measured)

| Token | OMC value |
|-------|-----------|
| Sidebar link size | `clamp(1.25rem, 1.5vw, 1.75rem)` bold |
| Section label | `text-xs uppercase tracking-widest opacity-45` |
| Panel enter | `translateY(-8px)` → `0`, opacity 0→1 |
| Sidebar stagger | 100ms per item, base delay ~400ms |
| Product stagger | 100ms per card, base delay ~400ms |
| Easing | `cubic-bezier(0.075, 0.82, 0.165, 1)` transform, `cubic-bezier(0.19, 1, 0.22, 1)` opacity |

---

## YBB gaps (before fix)

| Gap | OMC | YBB before |
|-----|-----|------------|
| Sidebar label | Collections | Collection / Category / B2B labels (Services, For Buyers…) |
| Product section | Best Sellers / Most popular | Most Popular |
| Sidebar children | Sub-collection list with hover tab | Flat links; products always from parent collection |
| View-all link | All {Child} (N) → per active sidebar | Parent collection only |
| Sold-out badge | On mega menu cards | Missing |
| Data shape | children + per-child featured SKUs | `sidebar.items` without `featuredProducts` |
| Tab crossfade | Sidebar hover swaps product grid | No inner crossfade |

## YBB changes (after fix)

| Area | Change |
|------|--------|
| `MegaMenu.tsx` | 3-zone layout: Collections sidebar · Best Sellers grid · All {child} (N) → |
| | `activeChildIndex` + hover/focus switches products with 200ms crossfade |
| | Sold-out badge reuses `product-card-badge--sold-out` |
| | Panel uses `page-container` horizontal inset |
| `navigation.json` | `megaMenu.children[]` with `featuredProducts` per sub-collection |
| `MobileNavDrawer.tsx` | Reads `children` + `shopAll` |
| `globals.css` | Sidebar active state + product grid crossfade classes |

## Files changed

- `components/layout/MegaMenu.tsx`
- `components/layout/MobileNavDrawer.tsx`
- `lib/data/navigation.json`
- `app/globals.css`
- `scripts/audit-omc-mega-menu.mjs` (new)
- `MEGA_MENU_AUDIT.md` (this file)

## Verification

- `npm run build` — passes (186 static pages)
- Nav pill hover animation preserved via `NavPill.tsx` / `Header.tsx` (unchanged)

## Screenshots

- `audit-screenshots/mega-menu/` (from audit script when nav probes succeed)
