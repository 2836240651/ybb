/**
 * OMC mega menu drawer audit — DOM structure, sidebar tabs, product grid
 * Run: node scripts/audit-omc-mega-menu.mjs
 * Output: scripts/omc-mega-menu-audit.json, MEGA_MENU_AUDIT.md
 */
import { createRequire } from "module";
import { mkdirSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const require = createRequire(import.meta.url);
const PLAYWRIGHT_ROOT = join(__dirname, "..", "..", "scripts", "node_modules", "playwright");
const { chromium } = require(PLAYWRIGHT_ROOT);
const OMC = "https://www.omctackle.com";
const OUT_JSON = join(__dirname, "omc-mega-menu-audit.json");
const OUT_MD = join(ROOT, "MEGA_MENU_AUDIT.md");
const SHOT_DIR = join(ROOT, "audit-screenshots", "mega-menu");

/** @param {import('playwright').Page} page */
async function dismissOverlays(page) {
  try {
    const close = page.locator(
      "button[aria-label*='close' i], button[aria-label*='Close' i], [class*='cookie'] button"
    );
    if ((await close.count()) > 0) {
      await close.first().click({ timeout: 2000 });
      await page.waitForTimeout(400);
    }
  } catch {
    /* ignore */
  }
}

/** @param {Element | null} node */
function probeNode(node) {
  if (!node) return null;
  const s = getComputedStyle(node);
  const r = node.getBoundingClientRect();
  return {
    tag: node.tagName.toLowerCase(),
    className: (node.className?.toString?.() || "").slice(0, 200),
    text: (node.textContent || "").trim().replace(/\s+/g, " ").slice(0, 120),
    width: Math.round(r.width),
    height: Math.round(r.height),
    top: Math.round(r.top),
    left: Math.round(r.left),
    padding: `${s.paddingTop} ${s.paddingRight} ${s.paddingBottom} ${s.paddingLeft}`,
    margin: `${s.marginTop} ${s.marginRight} ${s.marginBottom} ${s.marginLeft}`,
    gap: s.gap,
    display: s.display,
    gridTemplateColumns: s.gridTemplateColumns,
    flexDirection: s.flexDirection,
    fontSize: s.fontSize,
    fontWeight: s.fontWeight,
    letterSpacing: s.letterSpacing,
    textTransform: s.textTransform,
    color: s.color,
    opacity: s.opacity,
    transform: s.transform,
    transition: s.transition?.slice(0, 120),
    transitionDelay: s.transitionDelay,
  };
}

/** @param {import('playwright').Page} page */
async function getNavLabels(page) {
  return page.evaluate(() => {
    const items = [...document.querySelectorAll(".header__menu .menu__item")];
    return items
      .map((el) => {
        const summary = el.querySelector("summary");
        const raw = (summary?.textContent || el.textContent || "").trim();
        const text = raw.replace(/\s+/g, " ").replace(/^(.+?)\1$/, "$1");
        const hasMega = !!summary;
        return { text, hasMega };
      })
      .filter((x) => x.text);
  });
}

/** @param {import('playwright').Page} page */
async function probeOpenMega(page) {
  return page.evaluate(() => {
    const openDetails = document.querySelector('details[is="details-mega"][open]');
    const mega = openDetails?.querySelector(".mega-menu");
    if (!mega) return { error: "no open mega menu" };

    const container = mega.querySelector(".mega-menu__container");
    const inner = mega.querySelector(".page-width, .mega-menu__inner, [class*='page-width']");
    const sidebarCol =
      mega.querySelector(".mega-menu__nav") ||
      mega.querySelector("[class*='mega-menu__nav']") ||
      container?.firstElementChild;

    const collectionsLabel =
      mega.querySelector(".mega-menu__nav-label, .mega-menu p.uppercase, p.text-opacity") ||
      [...(mega.querySelectorAll("p") || [])].find((p) =>
        /collection/i.test(p.textContent || "")
      );

    const navItems = [...(mega.querySelectorAll(".mega-menu__nav-item") || [])].map((el, i) => {
      const link = el.querySelector("a") || el;
      const s = getComputedStyle(el);
      const active =
        el.classList.contains("active") ||
        el.classList.contains("is-active") ||
        link.classList.contains("active") ||
        parseFloat(s.fontWeight) >= 600 && parseFloat(s.opacity) > 0.9;
      return {
        index: i,
        label: (link.textContent || "").trim().replace(/\s+/g, " "),
        href: link.getAttribute?.("href") || null,
        active,
        ...probeNode(el),
      };
    });

    const shopAll =
      mega.querySelector(".mega-menu__shop-all a, .mega-menu__footer a, a[href*='collections']") ||
      [...mega.querySelectorAll("a")].find((a) =>
        /^shop\s/i.test(a.textContent || "")
      );

    const sectionLabels = [...mega.querySelectorAll("p.uppercase, .text-opacity, h3, h4")]
      .map((el) => (el.textContent || "").trim().replace(/\s+/g, " "))
      .filter(Boolean);

    const allLinks = [...mega.querySelectorAll("a[href]")].map((a) => ({
      text: (a.textContent || "").trim().replace(/\s+/g, " ").slice(0, 80),
      href: a.getAttribute("href"),
    }));

    const productItems = [...(mega.querySelectorAll(".mega-menu__item, .mega-menu__list .mega-menu__item") || [])];
    const productCards = productItems.map((item, i) => {
      const img = item.querySelector("img");
      const title =
        item.querySelector(".mega-menu__item-title, [class*='title'], p, h3, h4") ||
        item.querySelector("a");
      const price = item.querySelector("[class*='price'], .price, span.money");
      const badge = item.querySelector("[class*='badge'], [class*='sold']");
      const titleRect = title?.getBoundingClientRect();
      const priceRect = price?.getBoundingClientRect();
      return {
        index: i,
        title: (title?.textContent || "").trim().replace(/\s+/g, " ").slice(0, 80),
        price: (price?.textContent || "").trim(),
        soldOut: /sold\s*out/i.test(badge?.textContent || item.textContent || ""),
        badgeText: (badge?.textContent || "").trim().slice(0, 40),
        image: probeNode(img),
        card: probeNode(item),
        priceRightOfTitle: titleRect && priceRect ? priceRect.left > titleRect.left : null,
        sameRow: titleRect && priceRect ? Math.abs(titleRect.top - priceRect.top) < 8 : null,
      };
    });

    const grid = mega.querySelector(".mega-menu__list, [class*='mega-menu__list']");
    const headerRow = mega.querySelector(".mega-menu__header, [class*='mega-menu__header']");

    const viewAll =
      [...mega.querySelectorAll("a")].find((a) =>
        /^all\s/i.test(a.textContent || "") || /→/.test(a.textContent || "")
      ) || null;

    return {
      triggerLabel: openDetails?.querySelector("summary")?.textContent?.trim().replace(/\s+/g, " "),
      panel: probeNode(mega),
      container: probeNode(container),
      inner: probeNode(inner),
      sidebarCol: probeNode(sidebarCol),
      collectionsLabel: collectionsLabel
        ? {
            text: collectionsLabel.textContent?.trim(),
            ...probeNode(collectionsLabel),
          }
        : null,
      navItems,
      shopAll: shopAll
        ? {
            text: shopAll.textContent?.trim().replace(/\s+/g, " "),
            href: shopAll.getAttribute("href"),
            ...probeNode(shopAll),
          }
        : null,
      sectionLabels: [...new Set(sectionLabels)],
      viewAllLink: viewAll
        ? {
            text: viewAll.textContent?.trim().replace(/\s+/g, " "),
            href: viewAll.getAttribute("href"),
          }
        : null,
      productGrid: {
        ...probeNode(grid),
        columnCount: productItems.length,
      },
      productCards,
      allLinks: allLinks.slice(0, 30),
      headerRow: probeNode(headerRow),
      layout: {
        containerPadding: container ? getComputedStyle(container).padding : null,
        gridCols: grid ? getComputedStyle(grid).gridTemplateColumns : null,
        sidebarWidth: sidebarCol ? Math.round(sidebarCol.getBoundingClientRect().width) : null,
        productAreaLeft: productItems[0]
          ? Math.round(productItems[0].getBoundingClientRect().left)
          : null,
      },
    };
  });
}

/** @param {import('playwright').Page} page @param {string} label */
async function hoverNavAndProbe(page, label) {
  const loc = page.locator(".header__menu .menu__item").filter({ hasText: label }).first();
  if ((await loc.count()) === 0) {
    return { label, error: "nav item not found" };
  }
  await loc.hover();
  await page.waitForTimeout(1000);
  const open = await probeOpenMega(page);
  return { label, ...open };
}

/** @param {import('playwright').Page} page */
async function probeSidebarSwitch(page, navLabel) {
  await page.locator(".header__menu .menu__item").filter({ hasText: navLabel }).first().hover();
  await page.waitForTimeout(900);

  const before = await page.evaluate(() => {
    const items = [...document.querySelectorAll(".mega-menu__item")];
    return items.slice(0, 4).map((el) => ({
      title: (el.querySelector("a, p, h3, h4")?.textContent || "").trim().slice(0, 60),
    }));
  });

  const navCount = await page.locator(".mega-menu__nav-item").count();
  if (navCount < 2) {
    return { navLabel, error: "not enough sidebar items", before };
  }

  await page.locator(".mega-menu__nav-item").nth(1).hover();
  await page.waitForTimeout(700);

  const after = await page.evaluate(() => {
    const items = [...document.querySelectorAll(".mega-menu__item")];
    const activeNav = [...document.querySelectorAll(".mega-menu__nav-item")].map((el) => ({
      text: el.textContent?.trim().slice(0, 40),
      opacity: getComputedStyle(el).opacity,
      fontWeight: getComputedStyle(el).fontWeight,
      className: el.className?.toString?.().slice(0, 80),
    }));
    return {
      products: items.slice(0, 4).map((el) => ({
        title: (el.querySelector("a, p, h3, h4")?.textContent || "").trim().slice(0, 60),
      })),
      activeNav,
    };
  });

  return {
    navLabel,
    before,
    after: after.products,
    activeNavAfterHover: after.activeNav,
    productsChanged: JSON.stringify(before) !== JSON.stringify(after.products),
  };
}

function buildMd(audit) {
  const items = audit.navProbes || [];
  const hw = items.find((x) => /hardware/i.test(x.label || "")) || items[0];

  return `# OMC Mega Menu Audit

> Generated: ${audit.capturedAt.split("T")[0]}  
> Script: \`scripts/audit-omc-mega-menu.mjs\`  
> JSON: \`scripts/omc-mega-menu-audit.json\`  
> Benchmark: ${OMC}

## Nav items with mega menu

${audit.navLabels
  ?.filter((n) => n.hasMega)
  .map((n) => `- ${n.text}`)
  .join("\n") || "—"}

## Layout tokens (representative: ${hw?.label || "—"})

| Property | OMC value |
|----------|-----------|
| Panel padding | ${hw?.container?.padding || "—"} |
| Sidebar width | ${hw?.layout?.sidebarWidth ?? "—"}px |
| Product grid columns | ${hw?.productGrid?.gridTemplateColumns || hw?.productGrid?.columnCount || "—"} |
| Collections label | "${hw?.collectionsLabel?.text || hw?.sectionLabels?.[0] || "—"}" |
| Section label(s) | ${(hw?.sectionLabels || []).join(", ") || "—"} |
| Shop-all link | ${hw?.shopAll?.text || "—"} |
| View-all link | ${hw?.viewAllLink?.text || "—"} |
| Product card count | ${hw?.productCards?.length ?? "—"} |
| Price right of title | ${hw?.productCards?.[0]?.priceRightOfTitle ?? "—"} |
| Sold-out badges | ${hw?.productCards?.filter((c) => c.soldOut).length ?? 0} visible |

## Sidebar structure (${hw?.label || "—"})

| # | Label | Active | Font |
|---|-------|--------|------|
${(hw?.navItems || [])
  .map((n) => `| ${n.index} | ${n.label} | ${n.active} | ${n.fontSize} / ${n.fontWeight} |`)
  .join("\n")}

## Per-nav probes

${items
  .map(
    (p) => `### ${p.label}
- Sidebar items: ${(p.navItems || []).map((n) => n.label).join(" · ") || "—"}
- Product titles: ${(p.productCards || []).map((c) => c.title).slice(0, 4).join(" · ") || "—"}
- Shop all: ${p.shopAll?.text || "—"}
`
  )
  .join("\n")}

## Sidebar tab switching

${(audit.sidebarSwitches || [])
  .map(
    (s) =>
      `### ${s.navLabel}
- Products change on sidebar hover: **${s.productsChanged}**
- Before: ${(s.before || []).map((p) => p.title).join(", ") || "—"}
- After (2nd item hover): ${(s.after || []).map((p) => p.title).join(", ") || "—"}
`
  )
  .join("\n")}

## YBB gaps (pre-fix)

| Gap | OMC | YBB (before) |
|-----|-----|--------------|
| Sidebar label | Collections | Collection / Category / invented B2B labels |
| Product section | Best Sellers / Most popular | Most Popular |
| Sidebar interaction | Hover switches product grid + active state | Links navigate away; no tab state |
| View-all link | All {Subcategory} (N) → | Parent collection only |
| Sold-out badge | Vertical badge on image | Missing in mega menu cards |
| 3-zone layout | sidebar \\| grid \\| view-all | 2-column; sidebar missing when misconfigured |

## Screenshots

- \`audit-screenshots/mega-menu/\`
`;
}

async function main() {
  mkdirSync(SHOT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  console.log("Loading OMC...");
  await page.goto(OMC, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForTimeout(4000);
  await dismissOverlays(page);
  await page.waitForSelector(".header__menu .menu__item", { timeout: 30000 });

  const navLabels = await getNavLabels(page);
  const megaNavLabels = navLabels.filter((n) => n.hasMega).map((n) => n.text);

  const targetLabels = [
    "Hardware",
    "New",
    "Terminal Tackle",
    "Rods & Reels",
    "Bait",
    "Luggage",
  ].filter((t) => megaNavLabels.some((n) => n?.includes(t) || t.includes(n?.split(" ")[0] || "")));

  const probeLabels =
    targetLabels.length > 0
      ? [...new Set(targetLabels)]
      : megaNavLabels.slice(0, 8);

  if (probeLabels.length === 0) {
    console.warn("No mega nav matched; using first 6 mega items");
    probeLabels.push(...megaNavLabels.slice(0, 6));
  }

  console.log("Probing nav items:", probeLabels.join(", "));

  const navProbes = [];
  for (const label of probeLabels) {
    const match = megaNavLabels.find((n) => n.includes(label) || label.includes(n)) || label;
    console.log(`  → ${match}`);
    const data = await hoverNavAndProbe(page, match);
    navProbes.push(data);
    const safeName = match.replace(/[^\w]+/g, "-").toLowerCase();
    await page.screenshot({ path: join(SHOT_DIR, `omc-mega-${safeName}.png`) });
    await page.mouse.move(10, 10);
    await page.waitForTimeout(400);
  }

  const switchTargets = probeLabels.filter((l) => /hardware|terminal|bait|luggage/i.test(l));
  const sidebarSwitches = [];
  for (const label of switchTargets.slice(0, 3)) {
    const match = megaNavLabels.find((n) => n.includes(label) || label.includes(n)) || label;
    console.log(`  sidebar switch: ${match}`);
    sidebarSwitches.push(await probeSidebarSwitch(page, match));
    await page.mouse.move(10, 10);
    await page.waitForTimeout(300);
  }

  await context.close();
  await browser.close();

  const audit = {
    capturedAt: new Date().toISOString(),
    url: OMC,
    viewport: { width: 1440, height: 900 },
    navLabels,
    navProbes,
    sidebarSwitches,
  };

  writeFileSync(OUT_JSON, JSON.stringify(audit, null, 2));
  writeFileSync(OUT_MD, buildMd(audit));
  console.log("Wrote", OUT_JSON);
  console.log("Wrote", OUT_MD);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
