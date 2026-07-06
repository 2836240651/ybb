/**
 * OMC header interactions audit — nav pill, mega menu, scroll hide, icon hovers
 * Run: node scripts/audit-omc-header-interactions.mjs
 * Output: scripts/omc-header-interactions-audit.json, HEADER_INTERACTIONS_AUDIT.md
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
const OUT_JSON = join(__dirname, "omc-header-interactions-audit.json");
const OUT_MD = join(ROOT, "HEADER_INTERACTIONS_AUDIT.md");

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

const BROWSER_PROBE_FN = `function probeNode(node, pseudo) {
  if (!node) return null;
  const s = pseudo ? getComputedStyle(node, pseudo) : getComputedStyle(node);
  const r = node.getBoundingClientRect();
  return {
    transition: s.transition,
    transitionDuration: s.transitionDuration,
    transitionTimingFunction: s.transitionTimingFunction,
    transitionDelay: s.transitionDelay,
    transform: s.transform,
    opacity: s.opacity,
    visibility: s.visibility,
    pointerEvents: s.pointerEvents,
    color: s.color,
    backgroundColor: s.backgroundColor,
    width: Math.round(r.width),
    height: Math.round(r.height),
  };
}`;

/** @param {import('playwright').Page} page */
async function auditNavPillHover(page) {
  const selectors = [
    ".header__menu .menu__item",
    ".header__menu .menu__item > a.menu__link",
    ".header__menu .menu__item > details > summary",
  ];

  for (const sel of selectors) {
    const loc = page.locator(sel).first();
    if ((await loc.count()) === 0) continue;
    const visible = await loc.isVisible().catch(() => false);
    if (!visible) continue;

    const before = await loc.evaluate((node) => {
      function probeNode(n, pseudo) {
        if (!n) return null;
        const s = pseudo ? getComputedStyle(n, pseudo) : getComputedStyle(n);
        const r = n.getBoundingClientRect();
        return {
          transition: s.transition,
          transitionDuration: s.transitionDuration,
          transitionTimingFunction: s.transitionTimingFunction,
          transitionDelay: s.transitionDelay,
          transform: s.transform,
          opacity: s.opacity,
        };
      }
      const pill = node.matches(".menu__item")
        ? node
        : node.closest(".menu__item, a, summary, button") || node;
      const dup =
        pill.querySelector(".btn-duplicate") ||
        pill.querySelector("[class*='duplicate']") ||
        pill;
      const text =
        pill.querySelector(".btn-text, .menu__link-text") ||
        pill.querySelector("span:not(.btn-duplicate)") ||
        pill;
      return {
        pill: probeNode(pill),
        duplicate: probeNode(dup),
        text: probeNode(text),
      };
    });

    await loc.hover({ timeout: 8000 });
    await page.waitForTimeout(600);

    const after = await loc.evaluate((node) => {
      function probeNode(n, pseudo) {
        if (!n) return null;
        const s = pseudo ? getComputedStyle(n, pseudo) : getComputedStyle(n);
        return {
          transition: s.transition,
          transform: s.transform,
          opacity: s.opacity,
        };
      }
      const pill = node.matches(".menu__item")
        ? node
        : node.closest(".menu__item, a, summary, button") || node;
      const dup =
        pill.querySelector(".btn-duplicate") ||
        pill.querySelector("[class*='duplicate']") ||
        pill;
      const text =
        pill.querySelector(".btn-text, .menu__link-text") ||
        pill.querySelector("span:not(.btn-duplicate)") ||
        pill;
      return {
        pill: probeNode(pill),
        duplicate: probeNode(dup),
        text: probeNode(text),
      };
    });

    await page.mouse.move(8, 8);
    await page.waitForTimeout(300);
    return { selector: sel, before, after };
  }
  return { error: "nav pill selector not found" };
}

/** @param {import('playwright').Page} page */
async function auditIconHover(page) {
  const probes = [
    { key: "search", selectors: [".header__icon--search", "a[href*='search']", "button[aria-label*='Search' i]"] },
    { key: "cart", selectors: [".cart-drawer-button", "a[href*='/cart']"] },
  ];
  const results = {};

  for (const probe of probes) {
    let el = null;
    let matched = null;
    for (const sel of probe.selectors) {
      const loc = page.locator(sel).first();
      if ((await loc.count()) > 0 && (await loc.isVisible().catch(() => false))) {
        el = await loc.elementHandle();
        matched = sel;
        break;
      }
    }
    if (!el) {
      results[probe.key] = { error: "not found", selectors: probe.selectors };
      continue;
    }
    const before = await el.evaluate(new Function("node", `${BROWSER_PROBE_FN}
      return { self: probeNode(node), before: probeNode(node, "::before") };
    `));
    await el.hover({ timeout: 8000 });
    await page.waitForTimeout(500);
    const after = await el.evaluate(new Function("node", `${BROWSER_PROBE_FN}
      return { self: probeNode(node), before: probeNode(node, "::before") };
    `));
    results[probe.key] = { selector: matched, before, after };
    await page.mouse.move(8, 8);
    await page.waitForTimeout(200);
  }
  return results;
}

/** @param {import('playwright').Page} page */
async function auditMegaMenu(page) {
  const triggers = [
    ".header__menu .menu__item details summary",
    ".header__menu .menu__item > a.menu__link",
    ".header__menu .menu__item",
  ];
  let opened = false;
  for (const sel of triggers) {
    const loc = page.locator(sel).first();
    if ((await loc.count()) === 0) continue;
    if (!(await loc.isVisible().catch(() => false))) continue;
    await loc.hover({ timeout: 8000 });
    await page.waitForTimeout(900);
    opened = true;
    break;
  }
  if (!opened) return { error: "mega trigger not found" };

  const snapshots = [];
  for (const delay of [0, 200, 500, 1000]) {
    if (delay) await page.waitForTimeout(delay);
    snapshots.push({
      delayMs: delay,
      ...(await page.evaluate(new Function(`${BROWSER_PROBE_FN}
        const panel = document.querySelector(".mega-menu") || document.querySelector("[class*='mega-menu']:not(.mega-menu__link)");
        const sidebarLink = panel?.querySelector("a, .mega-menu__nav a");
        const product = panel?.querySelector(".product-card, [class*='product-card']");
        return {
          panel: probeNode(panel),
          sidebarLink: probeNode(sidebarLink),
          product: probeNode(product),
          openDetails: !!document.querySelector("details[is='details-mega'][open], details[open] .mega-menu"),
        };
      `))),
    });
  }
  return { snapshots };
}

/** @param {import('playwright').Page} page */
async function auditScrollHide(page) {
  const vh = await page.evaluate(() => window.innerHeight);
  const scrollSteps = [0, 100, 300, 500, Math.round(vh * 2), Math.round(vh * 3), Math.round(vh * 3.5)];
  const samples = [];

  for (const y of scrollSteps) {
    await page.evaluate((scrollY) => window.scrollTo({ top: scrollY, behavior: "instant" }), y);
    await page.waitForTimeout(y === 0 ? 400 : 700);
    samples.push(
      await page.evaluate(
        new Function(
          "scrollY",
          `${BROWSER_PROBE_FN}
        const section = document.querySelector(".shopify-section-header-sticky") ||
          document.querySelector(".header-section.header-sticky") ||
          document.querySelector("sticky-header")?.closest(".shopify-section");
        const header = document.querySelector("header.header") || document.querySelector("header");
        return {
          scrollY,
          vh: window.innerHeight,
          threshold3vh: window.innerHeight * 3,
          sectionClasses: section?.className?.toString?.() || "",
          header: probeNode(header),
          section: probeNode(section),
        };
      `
        ),
        y
      )
    );
  }

  await page.evaluate(() => window.scrollTo({ top: window.innerHeight * 3.5, behavior: "instant" }));
  await page.waitForTimeout(300);
  await page.evaluate(() => window.scrollBy(0, 60));
  await page.waitForTimeout(600);
  const hidden = await page.evaluate(new Function(`${BROWSER_PROBE_FN}
    const header = document.querySelector("header.header") || document.querySelector("header");
    return { scrollY: window.scrollY, header: probeNode(header) };
  `));

  await page.evaluate(() => window.scrollTo({ top: 80, behavior: "instant" }));
  await page.waitForTimeout(100);
  const revealSamples = [];
  for (let i = 0; i < 6; i++) {
    await page.waitForTimeout(150);
    revealSamples.push(
      await page.evaluate(new Function(`${BROWSER_PROBE_FN}
        const header = document.querySelector("header.header") || document.querySelector("header");
        return probeNode(header);
      `))
    );
  }

  let threshold3vh = null;
  for (let i = 1; i < samples.length; i++) {
    const prev = samples[i - 1];
    const curr = samples[i];
    const prevT = prev.header?.transform || "none";
    const currT = curr.header?.transform || "none";
    if (prevT === "none" && currT !== "none" && threshold3vh === null) {
      threshold3vh = curr.scrollY;
    }
  }

  return { samples, hidden, revealSamples, inferredHideThresholdPx: threshold3vh };
}

function buildMd(audit) {
  const pill = audit.navPill;
  const icons = audit.icons;
  const mega = audit.megaMenu;
  const scroll = audit.scrollHide;

  return `# OMC Header Interactions Audit

> Generated: ${audit.capturedAt.split("T")[0]}  
> Script: \`scripts/audit-omc-header-interactions.mjs\`  
> JSON: \`scripts/omc-header-interactions-audit.json\`

## Nav pill (btn-duplicate)

| State | duplicate transform | text opacity |
|-------|---------------------|--------------|
| default | ${pill.before?.duplicate?.transform ?? "—"} | ${pill.before?.text?.opacity ?? "—"} |
| :hover | ${pill.after?.duplicate?.transform ?? "—"} | ${pill.after?.text?.opacity ?? "—"} |

## Icon hovers (::before fill)

| Icon | default ::before | hover ::before |
|------|------------------|----------------|
| Search | opacity ${icons.search?.before?.before?.opacity ?? "—"}, transform ${icons.search?.before?.before?.transform ?? "—"} | opacity ${icons.search?.after?.before?.opacity ?? "—"}, transform ${icons.search?.after?.before?.transform ?? "—"} |
| Cart | opacity ${icons.cart?.before?.before?.opacity ?? "—"} | opacity ${icons.cart?.after?.before?.opacity ?? "—"} |

## Mega menu enter (stagger samples)

${mega.snapshots
  ?.map(
    (s) =>
      `- **+${s.delayMs}ms**: panel opacity=${s.panel?.opacity}, sidebar opacity=${s.sidebarLink?.opacity}, delay=${s.sidebarLink?.transitionDelay}, transform=${(s.sidebarLink?.transform || "none").slice(0, 40)}`
  )
  .join("\n") ?? "—"}

## Scroll hide

| Property | OMC measured |
|----------|--------------|
| Hide threshold (~transform) | ${scroll.inferredHideThresholdPx ?? "~"}px scrollY |
| 3× viewport (reference) | ${scroll.samples?.find((s) => s.scrollY > 0)?.threshold3vh ?? "—"}px |
| Header transition | ${scroll.hidden?.header?.transition ?? "—"} |
| Hidden transform | ${scroll.hidden?.header?.transform ?? "—"} |
| Hidden opacity | ${scroll.hidden?.header?.opacity ?? "—"} |

### Scroll samples

| scrollY | header transform | section classes (snippet) |
|---------|------------------|---------------------------|
${scroll.samples
  ?.map(
    (s) =>
      `| ${s.scrollY} | ${(s.header?.transform || "none").slice(0, 36)} | ${(s.sectionClasses || "").slice(0, 50)} |`
  )
  .join("\n")}

### Reveal on scroll to top (opacity samples)

${scroll.revealSamples?.map((s, i) => `- +${(i + 1) * 150}ms: opacity=${s?.opacity}, transform=${(s?.transform || "none").slice(0, 30)}`).join("\n") ?? "—"}
`;
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  console.log("OMC header interactions @ 1440px...");
  await page.goto(OMC, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForTimeout(3000);
  await dismissOverlays(page);

  const navPill = await auditNavPillHover(page);
  const icons = await auditIconHover(page);

  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await page.waitForTimeout(500);
  const megaMenu = await auditMegaMenu(page);

  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await page.waitForTimeout(500);
  const scrollHide = await auditScrollHide(page);

  await context.close();
  await browser.close();

  const audit = {
    capturedAt: new Date().toISOString(),
    url: OMC,
    viewport: { width: 1440, height: 900 },
    navPill,
    icons,
    megaMenu,
    scrollHide,
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
