/**
 * OMC header layout + scroll-hide audit — desktop 1440
 * Run: node scripts/audit-omc-header-scroll.mjs
 * Output: scripts/omc-header-scroll-audit.json, HEADER_SCROLL_AUDIT.md
 */
import { createRequire } from "module";
import { mkdirSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const require = createRequire(import.meta.url);
const { chromium } = require("../../scripts/node_modules/playwright");

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const OMC = "https://www.omctackle.com";
const OUT_JSON = join(__dirname, "omc-header-scroll-audit.json");
const OUT_MD = join(ROOT, "HEADER_SCROLL_AUDIT.md");
const SHOT_DIR = join(ROOT, "audit-screenshots", "header");

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

/** @param {import('playwright').Page} page */
async function auditHeaderLayout(page) {
  await page.goto(OMC, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForTimeout(3000);
  await dismissOverlays(page);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await page.waitForTimeout(500);

  return page.evaluate(() => {
    function probeNode(node) {
      if (!node) return null;
      const s = getComputedStyle(node);
      const r = node.getBoundingClientRect();
      return {
        tag: node.tagName.toLowerCase(),
        className: (node.className?.toString?.() || "").slice(0, 300),
        id: node.id || null,
        text: (node.textContent || "").trim().slice(0, 80),
        width: Math.round(r.width),
        height: Math.round(r.height),
        top: Math.round(r.top),
        left: Math.round(r.left),
        right: Math.round(r.right),
        centerX: Math.round(r.left + r.width / 2),
        padding: `${s.paddingTop} ${s.paddingRight} ${s.paddingBottom} ${s.paddingLeft}`,
        margin: `${s.marginTop} ${s.marginRight} ${s.marginBottom} ${s.marginLeft}`,
        gap: s.gap,
        display: s.display,
        flexDirection: s.flexDirection,
        flex: s.flex,
        flexGrow: s.flexGrow,
        flexShrink: s.flexShrink,
        justifyContent: s.justifyContent,
        alignItems: s.alignItems,
        gridTemplateColumns: s.gridTemplateColumns,
        position: s.position,
        topCss: s.top,
        zIndex: s.zIndex,
        transform: s.transform,
        opacity: s.opacity,
        transition: s.transition,
        transitionProperty: s.transitionProperty,
        transitionDuration: s.transitionDuration,
        transitionTimingFunction: s.transitionTimingFunction,
        visibility: s.visibility,
        fontSize: s.fontSize,
        fontWeight: s.fontWeight,
      };
    }

    const vw = window.innerWidth;

    const announcement =
      document.querySelector(".announcement-bar, [class*='announcement']") ||
      document.querySelector('[id*="announcement"]');

    const headerSection =
      document.querySelector(".shopify-section-header-sticky") ||
      document.querySelector("sticky-header") ||
      document.querySelector("header.header")?.closest(".shopify-section") ||
      document.querySelector("header.header")?.parentElement;

    const header =
      document.querySelector("header.header") ||
      document.querySelector("header[class*='header']") ||
      document.querySelector("header");

    const headerInner =
      header?.querySelector(".header__content, .header__inline, [class*='header__content']") ||
      header?.querySelector(".page-width") ||
      header?.querySelector("div");

    const logo =
      header?.querySelector(".header__logo, [class*='header__heading'] a, .header__heading-link") ||
      header?.querySelector("a[href='/']");

    const logoImg = header?.querySelector(".header__logo img, .header__heading img, header img");

    const nav =
      header?.querySelector("nav.header__menu, nav[class*='header__menu'], nav") ||
      header?.querySelector(".header__inline-menu");

    const navLinks = nav
      ? [...nav.querySelectorAll("a, summary, button")].filter(
          (el) => el.getBoundingClientRect().height > 10
        )
      : [];

    const utilities = header?.querySelector(
      ".header__icons, .header__icons--end, [class*='header__icons']"
    );

    const searchBtn =
      header?.querySelector(
        "a[href*='search'], button[aria-label*='Search' i], .header__icon--search, [class*='search']"
      ) || utilities?.querySelector("a, button");

    const accountBtn = header?.querySelector(
      "a[href*='account'], button[aria-label*='account' i], .header__icon--account"
    );

    const cartBtn = header?.querySelector(
      "a[href*='cart'], button[aria-label*='cart' i], .header__icon--cart, cart-drawer a"
    );

    const utilityButtons = utilities
      ? [...utilities.querySelectorAll("a, button")].filter(
          (el) => el.getBoundingClientRect().height > 10
        )
      : [];

    const navCenterX =
      navLinks.length > 0
        ? Math.round(
            (navLinks[0].getBoundingClientRect().left +
              navLinks[navLinks.length - 1].getBoundingClientRect().right) /
              2
          )
        : null;

    const viewportCenterX = Math.round(vw / 2);

    return {
      viewportWidth: vw,
      announcement: probeNode(announcement),
      headerSection: probeNode(headerSection),
      header: probeNode(header),
      headerInner: probeNode(headerInner),
      layout: {
        headerInnerDisplay: headerInner ? getComputedStyle(headerInner).display : null,
        headerInnerJustify: headerInner ? getComputedStyle(headerInner).justifyContent : null,
        headerInnerGridCols: headerInner ? getComputedStyle(headerInner).gridTemplateColumns : null,
        isGrid3: headerInner
          ? getComputedStyle(headerInner).display === "grid" &&
            getComputedStyle(headerInner).gridTemplateColumns.split(" ").length >= 3
          : false,
        isFlexBetween:
          headerInner &&
          getComputedStyle(headerInner).display === "flex" &&
          getComputedStyle(headerInner).justifyContent.includes("space-between"),
      },
      logo: {
        ...probeNode(logo),
        hasImage: !!logoImg,
        image: probeNode(logoImg),
        textOnly: logo && !logoImg,
      },
      nav: {
        ...probeNode(nav),
        linkCount: navLinks.length,
        linkLabels: navLinks.map((el) => (el.textContent || "").trim().slice(0, 40)),
        centerX: navCenterX,
        viewportCenterX,
        centeredInViewport:
          navCenterX !== null ? Math.abs(navCenterX - viewportCenterX) < 80 : null,
        firstLink: probeNode(navLinks[0]),
        lastLink: probeNode(navLinks[navLinks.length - 1]),
      },
      utilities: {
        container: probeNode(utilities),
        buttonCount: utilityButtons.length,
        buttons: utilityButtons.map((el) => ({
          ...probeNode(el),
          ariaLabel: el.getAttribute("aria-label"),
          visibleText: (el.textContent || "").trim().slice(0, 30),
          hasVisibleText:
            (el.textContent || "").trim().length > 0 &&
            el.querySelector("svg") &&
            (el.textContent || "").trim().length < 20,
          iconOnly:
            !!el.querySelector("svg, .icon, img") &&
            !(el.textContent || "").trim().match(/^(Search|Account|Cart)$/i),
        })),
        gap: utilities ? getComputedStyle(utilities).gap : null,
      },
      search: probeNode(searchBtn),
      account: probeNode(accountBtn),
      cart: probeNode(cartBtn),
      zones: {
        logoRight: logo ? Math.round(logo.getBoundingClientRect().right) : null,
        navLeft: navLinks[0] ? Math.round(navLinks[0].getBoundingClientRect().left) : null,
        navRight: navLinks.length
          ? Math.round(navLinks[navLinks.length - 1].getBoundingClientRect().right)
          : null,
        utilitiesLeft: utilities
          ? Math.round(utilities.getBoundingClientRect().left)
          : null,
        logoZoneWidth: logo ? Math.round(logo.getBoundingClientRect().width) : null,
      },
      stickyHeaderEl: {
        tag: headerSection?.tagName?.toLowerCase() || null,
        className: headerSection?.className?.toString?.() || null,
        shopifySticky: headerSection?.classList?.contains?.("shopify-section-header-sticky"),
      },
      headerClassesAtTop: header?.className?.toString?.() || null,
      sectionClassesAtTop: headerSection?.className?.toString?.() || null,
    };
  });
}

/** @param {import('playwright').Page} page */
async function auditScrollBehavior(page) {
  const scrollSteps = [0, 50, 100, 150, 200, 300, 500, 800];
  const samples = [];

  for (const y of scrollSteps) {
    await page.evaluate((scrollY) => window.scrollTo({ top: scrollY, behavior: "instant" }), y);
    await page.waitForTimeout(600);

    const sample = await page.evaluate((scrollY) => {
      const announcement =
        document.querySelector(".announcement-bar, [class*='announcement']") ||
        document.querySelector('[id*="announcement"]');
      const headerSection =
        document.querySelector(".shopify-section-header-sticky") ||
        document.querySelector("sticky-header") ||
        document.querySelector("header.header")?.closest(".shopify-section");
      const header =
        document.querySelector("header.header") ||
        document.querySelector("header[class*='header']") ||
        document.querySelector("header");

      const stickyWrapper =
        document.querySelector("sticky-header") ||
        document.querySelector(".header-wrapper") ||
        headerSection;

      return {
        scrollY,
        announcement: announcement
          ? {
              top: Math.round(announcement.getBoundingClientRect().top),
              transform: getComputedStyle(announcement).transform,
              opacity: getComputedStyle(announcement).opacity,
              visibility: getComputedStyle(announcement).visibility,
            }
          : null,
        headerSection: headerSection
          ? {
              className: headerSection.className?.toString?.() || "",
              top: Math.round(headerSection.getBoundingClientRect().top),
              transform: getComputedStyle(headerSection).transform,
              opacity: getComputedStyle(headerSection).opacity,
              position: getComputedStyle(headerSection).position,
            }
          : null,
        header: header
          ? {
              className: header.className?.toString?.() || "",
              top: Math.round(header.getBoundingClientRect().top),
              transform: getComputedStyle(header).transform,
              opacity: getComputedStyle(header).opacity,
              transition: getComputedStyle(header).transition,
            }
          : null,
        stickyWrapper: stickyWrapper
          ? {
              tag: stickyWrapper.tagName.toLowerCase(),
              className: stickyWrapper.className?.toString?.() || "",
              top: Math.round(stickyWrapper.getBoundingClientRect().top),
              transform: getComputedStyle(stickyWrapper).transform,
              opacity: getComputedStyle(stickyWrapper).opacity,
              position: getComputedStyle(stickyWrapper).position,
              transition: getComputedStyle(stickyWrapper).transition,
            }
          : null,
      };
    }, y);

    samples.push(sample);
  }

  // Scroll down then up to detect reappear
  await page.evaluate(() => window.scrollTo({ top: 600, behavior: "instant" }));
  await page.waitForTimeout(800);
  const scrolledDown = await page.evaluate(() => {
    const headerSection =
      document.querySelector(".shopify-section-header-sticky") ||
      document.querySelector("sticky-header") ||
      document.querySelector("header.header")?.closest(".shopify-section");
    const header = document.querySelector("header.header") || document.querySelector("header");
    return {
      scrollY: window.scrollY,
      headerSectionClass: headerSection?.className?.toString?.() || "",
      headerClass: header?.className?.toString?.() || "",
      headerTop: header ? Math.round(header.getBoundingClientRect().top) : null,
      headerTransform: header ? getComputedStyle(header).transform : null,
      sectionTransform: headerSection ? getComputedStyle(headerSection).transform : null,
    };
  });

  await page.evaluate(() => window.scrollTo({ top: 100, behavior: "instant" }));
  await page.waitForTimeout(800);
  const scrolledUp = await page.evaluate(() => {
    const headerSection =
      document.querySelector(".shopify-section-header-sticky") ||
      document.querySelector("sticky-header") ||
      document.querySelector("header.header")?.closest(".shopify-section");
    const header = document.querySelector("header.header") || document.querySelector("header");
    return {
      scrollY: window.scrollY,
      headerSectionClass: headerSection?.className?.toString?.() || "",
      headerClass: header?.className?.toString?.() || "",
      headerTop: header ? Math.round(header.getBoundingClientRect().top) : null,
      headerTransform: header ? getComputedStyle(header).transform : null,
      sectionTransform: headerSection ? getComputedStyle(headerSection).transform : null,
    };
  });

  const jsHints = await page.evaluate(() => {
    const sticky = document.querySelector("sticky-header");
    const hints = {
      hasStickyHeaderCustomEl: !!sticky,
      stickyHeaderAttrs: sticky
        ? {
            "data-sticky-type": sticky.getAttribute("data-sticky-type"),
            className: sticky.className?.toString?.(),
          }
        : null,
      bodyClasses: document.body.className?.toString?.().slice(0, 200),
      scrollClasses: [],
    };

    const all = document.querySelectorAll(
      "[class*='header-hidden'], [class*='header--compact'], [class*='shopify-section-header']"
    );
    hints.scrollClasses = [...all].map((el) => ({
      tag: el.tagName.toLowerCase(),
      className: el.className?.toString?.().slice(0, 200),
    }));

    return hints;
  });

  return { samples, scrolledDown, scrolledUp, jsHints };
}

function inferScrollThreshold(samples) {
  let threshold = null;
  for (let i = 1; i < samples.length; i++) {
    const prev = samples[i - 1];
    const curr = samples[i];
    const prevTop = prev.header?.top ?? prev.stickyWrapper?.top ?? 0;
    const currTop = curr.header?.top ?? curr.stickyWrapper?.top ?? 0;
    const prevTransform = prev.header?.transform ?? prev.stickyWrapper?.transform ?? "none";
    const currTransform = curr.header?.transform ?? curr.stickyWrapper?.transform ?? "none";
    if (
      (currTop < prevTop - 20 || (prevTransform === "none" && currTransform !== "none")) &&
      threshold === null
    ) {
      threshold = curr.scrollY;
    }
  }
  return threshold;
}

function buildMd(audit) {
  const layout = audit.layout;
  const scroll = audit.scroll;
  const threshold = inferScrollThreshold(scroll.samples);

  return `# OMC Header Layout & Scroll Audit

> Generated: ${audit.capturedAt.split("T")[0]}  
> Script: \`scripts/audit-omc-header-scroll.mjs\`  
> JSON: \`scripts/omc-header-scroll-audit.json\`

## Desktop layout (1440px)

| Zone | Measurement |
|------|-------------|
| Viewport | ${layout.viewportWidth}px |
| Header height | ${layout.header?.height}px |
| Header padding | ${layout.headerInner?.padding || layout.header?.padding} |
| Logo zone width | ${layout.zones.logoZoneWidth}px |
| Logo has image | ${layout.logo.hasImage} |
| Nav link count | ${layout.nav.linkCount} |
| Nav center X | ${layout.nav.centerX}px (viewport center ${layout.nav.viewportCenterX}px) |
| Nav centered in viewport | ${layout.nav.centeredInViewport} |
| Utilities gap | ${layout.utilities.gap} |
| Layout mode | display=${layout.layout.headerInnerDisplay}, justify=${layout.layout.headerInnerJustify}, grid=${layout.layout.headerInnerGridCols} |
| Grid 3-col | ${layout.layout.isGrid3} |
| Flex justify-between | ${layout.layout.isFlexBetween} |

### Nav labels
${layout.nav.linkLabels?.map((l) => `- ${l}`).join("\n") || "—"}

### Utility buttons (icon-only?)
${layout.utilities.buttons
  ?.map(
    (b) =>
      `- ${b.ariaLabel || b.visibleText || "button"}: iconOnly=${b.iconOnly}, text="${b.visibleText}", gap container ${layout.utilities.gap}`
  )
  .join("\n") || "—"}

## Scroll hide behavior

| Property | Value |
|----------|-------|
| Inferred threshold | ~${threshold ?? "unknown"}px scrollY |
| Sticky element | \`${scroll.jsHints.stickyHeaderAttrs?.className || scroll.jsHints.hasStickyHeaderCustomEl ? "sticky-header" : "section"}\` |
| data-sticky-type | ${scroll.jsHints.stickyHeaderAttrs?.["data-sticky-type"] ?? "—"} |
| Transition (header @ scroll) | ${scroll.samples.find((s) => s.scrollY === 200)?.header?.transition || "—"} |

### Scroll samples (top / transform)

| scrollY | header top | header transform | section class (snippet) |
|---------|------------|------------------|-------------------------|
${scroll.samples
  .map(
    (s) =>
      `| ${s.scrollY} | ${s.header?.top ?? "—"} | ${(s.header?.transform || s.stickyWrapper?.transform || "none").slice(0, 40)} | ${(s.headerSection?.className || s.stickyWrapper?.className || "").slice(0, 60)} |`
  )
  .join("\n")}

### Scroll down (y≈600) vs scroll up (y≈100)

- **Down**: top=${scroll.scrolledDown.headerTop}, transform=${scroll.scrolledDown.headerTransform}, classes=\`${scroll.scrolledDown.headerSectionClass.slice(0, 80)}\`
- **Up**: top=${scroll.scrolledUp.headerTop}, transform=${scroll.scrolledUp.headerTransform}, classes=\`${scroll.scrolledUp.headerSectionClass.slice(0, 80)}\`

### Announcement bar on scroll

${scroll.samples
  .filter((s) => s.scrollY === 0 || s.scrollY === 300)
  .map(
    (s) =>
      `- scrollY=${s.scrollY}: announcement top=${s.announcement?.top}, opacity=${s.announcement?.opacity}`
  )
  .join("\n")}

## Classes observed

${scroll.jsHints.scrollClasses?.map((c) => `- \`${c.tag}.${c.className}\``).join("\n") || "—"}
`;
}

async function main() {
  mkdirSync(SHOT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  console.log("Auditing OMC header layout @ 1440px...");
  const layout = await auditHeaderLayout(page);

  mkdirSync(SHOT_DIR, { recursive: true });
  await page.screenshot({ path: join(SHOT_DIR, "omc-header-top.png") });

  console.log("Auditing scroll behavior...");
  const scroll = await auditScrollBehavior(page);
  await page.screenshot({ path: join(SHOT_DIR, "omc-header-scrolled.png") });

  await context.close();
  await browser.close();

  const audit = {
    capturedAt: new Date().toISOString(),
    url: OMC,
    layout,
    scroll,
    inferredScrollThreshold: inferScrollThreshold(scroll.samples),
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
