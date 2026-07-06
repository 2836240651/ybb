/**
 * OMC announcement bar deep audit — desktop 1440 + mobile 390
 * Run: node scripts/audit-omc-announcement-bar.mjs
 * Output: scripts/omc-announcement-bar-audit.json, ANNOUNCEMENT_BAR_AUDIT.md
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
const OUT_JSON = join(__dirname, "omc-announcement-bar-audit.json");
const OUT_MD = join(ROOT, "ANNOUNCEMENT_BAR_AUDIT.md");
const SHOT_DIR = join(ROOT, "audit-screenshots", "announcement-bar");

const VIEWPORTS = [
  { label: "desktop", width: 1440, height: 900 },
  { label: "mobile", width: 390, height: 844 },
];

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
async function auditViewport(page, viewport) {
  await page.setViewportSize({ width: viewport.width, height: viewport.height });
  await page.goto(OMC, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForTimeout(3000);
  await dismissOverlays(page);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await page.waitForTimeout(500);

  mkdirSync(SHOT_DIR, { recursive: true });
  await page.screenshot({
    path: join(SHOT_DIR, `omc-announcement-${viewport.label}.png`),
    clip: { x: 0, y: 0, width: viewport.width, height: 80 },
  });

  return page.evaluate(() => {
    function probeNode(node, depth = 0) {
      if (!node || depth > 6) return null;
      const s = getComputedStyle(node);
      const r = node.getBoundingClientRect();
      const children = [...node.children].map((c) => probeNode(c, depth + 1)).filter(Boolean);

      const animName = s.animationName;
      const animDuration = s.animationDuration;
      const animTiming = s.animationTimingFunction;
      const transform = s.transform;

      const svgs = node.querySelectorAll?.("svg")?.length ?? 0;
      const links = node.querySelectorAll?.("a")?.length ?? 0;
      const buttons = node.querySelectorAll?.("button")?.length ?? 0;

      return {
        tag: node.tagName.toLowerCase(),
        className: (node.className?.toString?.() || "").slice(0, 300),
        id: node.id || null,
        role: node.getAttribute?.("role") || null,
        ariaLabel: node.getAttribute?.("aria-label") || null,
        text: (node.childNodes.length === 1 && node.childNodes[0].nodeType === 3
          ? node.textContent
          : ""
        )
          ?.trim?.()
          ?.slice(0, 120),
        directText: [...node.childNodes]
          .filter((n) => n.nodeType === 3)
          .map((n) => n.textContent?.trim())
          .filter(Boolean)
          .join(" ")
          .slice(0, 120),
        width: Math.round(r.width),
        height: Math.round(r.height),
        top: Math.round(r.top),
        left: Math.round(r.left),
        right: Math.round(r.right),
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
        overflow: s.overflow,
        overflowX: s.overflowX,
        position: s.position,
        zIndex: s.zIndex,
        fontSize: s.fontSize,
        fontWeight: s.fontWeight,
        lineHeight: s.lineHeight,
        letterSpacing: s.letterSpacing,
        textTransform: s.textTransform,
        color: s.color,
        backgroundColor: s.backgroundColor,
        animationName: animName,
        animationDuration: animDuration,
        animationTimingFunction: animTiming,
        animationPlayState: s.animationPlayState,
        transform,
        transition: s.transition,
        svgCount: svgs,
        linkCount: links,
        buttonCount: buttons,
        childCount: node.children?.length ?? 0,
        children,
      };
    }

    const bar =
      document.querySelector(".announcement-bar") ||
      document.querySelector("[class*='announcement-bar']") ||
      document.querySelector('[id*="announcement"]');

    const section = bar?.closest(".shopify-section") || bar?.parentElement;

    const marquee =
      document.querySelector(".announcement-bar__marquee") ||
      document.querySelector("[class*='marquee']") ||
      bar?.querySelector("[class*='marquee']");

    const socialLinks = bar
      ? [...bar.querySelectorAll("a[href*='facebook'], a[href*='instagram'], a[href*='youtube'], a[href*='tiktok'], a svg")]
      : [];

    const localization =
      document.querySelector("localization-form") ||
      document.querySelector("[class*='localization']") ||
      bar?.querySelector("[class*='localization'], [class*='locale'], [class*='language']");

    const countrySelector =
      document.querySelector("country-selector") ||
      bar?.querySelector("[class*='country'], [class*='currency']");

    const flexChildren = bar
      ? [...bar.children].map((c, i) => ({
          index: i,
          ...probeNode(c, 0),
        }))
      : [];

    const socialIconAudit = bar
      ? [...bar.querySelectorAll("a")].map((a) => {
          const svg = a.querySelector("svg");
          const r = a.getBoundingClientRect();
          return {
            href: a.getAttribute("href")?.slice(0, 80),
            ariaLabel: a.getAttribute("aria-label"),
            text: a.textContent?.trim().slice(0, 40),
            hasSvg: !!svg,
            svgViewBox: svg?.getAttribute("viewBox"),
            width: Math.round(r.width),
            left: Math.round(r.left),
          };
        })
      : [];

    return {
      viewportWidth: window.innerWidth,
      bar: probeNode(bar),
      section: probeNode(section),
      marquee: probeNode(marquee),
      localization: probeNode(localization),
      countrySelector: probeNode(countrySelector),
      flexChildren,
      socialIconAudit,
      layoutOrder: flexChildren.map((c) => ({
        index: c.index,
        className: c.className,
        display: c.display,
        width: c.width,
        left: c.left,
        text: c.directText || c.text,
        svgCount: c.svgCount,
        linkCount: c.linkCount,
      })),
      htmlSnippet: bar?.outerHTML?.slice(0, 4000) || null,
    };
  });
}

function buildMarkdown(audit) {
  const d = audit.viewports.desktop;
  const m = audit.viewports.mobile;

  return `# OMC Announcement Bar Audit

Captured: ${audit.capturedAt}
Source: ${OMC}

## Desktop (${d?.viewportWidth ?? 1440}px)

### Bar metrics
| Property | Value |
|----------|-------|
| Height | ${d?.bar?.height ?? "—"}px |
| Font size | ${d?.bar?.fontSize ?? "—"} |
| Background | ${d?.bar?.backgroundColor ?? "—"} |
| Display | ${d?.bar?.display ?? "—"} ${d?.bar?.flexDirection ?? ""} |
| Overflow | ${d?.bar?.overflow ?? "—"} |

### Flex child order (left → right)
${(d?.layoutOrder ?? [])
  .map(
    (c) =>
      `${c.index + 1}. \`${c.className?.slice(0, 80) || "?"}\` — w=${c.width}px left=${c.left}px svgs=${c.svgCount} links=${c.linkCount} — "${c.text?.slice(0, 60) || ""}"`
  )
  .join("\n")}

### Marquee animation
| Property | Value |
|----------|-------|
| Class | \`${d?.marquee?.className?.slice(0, 120) || "—"}\` |
| Animation | ${d?.marquee?.animationName ?? "—"} |
| Duration | ${d?.marquee?.animationDuration ?? "—"} |
| Timing | ${d?.marquee?.animationTimingFunction ?? "—"} |
| Overflow | ${d?.marquee?.overflow ?? "—"} |

### Social icons (${d?.socialIconAudit?.length ?? 0})
${(d?.socialIconAudit ?? [])
  .map(
    (s) =>
      `- ${s.hasSvg ? "SVG" : "text"} \`${s.ariaLabel || s.text || "?"}\` href=${s.href} left=${s.left}px`
  )
  .join("\n")}

### Localization / country
- Localization: \`${d?.localization?.className?.slice(0, 100) || "not found"}\`
- Country: \`${d?.countrySelector?.className?.slice(0, 100) || "not found"}\`

## Mobile (${m?.viewportWidth ?? 390}px)

| Property | Value |
|----------|-------|
| Bar height | ${m?.bar?.height ?? "—"}px |
| Visible children | ${m?.layoutOrder?.length ?? "—"} |
| Social visible | ${m?.socialIconAudit?.filter((s) => s.hasSvg).length ?? 0} icons |

Mobile layout order:
${(m?.layoutOrder ?? [])
  .map((c) => `- ${c.className?.slice(0, 80)} w=${c.width}`)
  .join("\n")}

## Target ybb-site layout (desktop md+)

\`\`\`
[ marquee flex-1 overflow-hidden ]  [ FB IG YT TT icons ]  [ 🌐 Language ▾ ]  [ 🏳 Country/Currency ▾ ]
\`\`\`

Screenshots: \`audit-screenshots/announcement-bar/\`
`;
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  const viewports = {};
  for (const vp of VIEWPORTS) {
    console.log(`Auditing ${vp.label} (${vp.width}px)...`);
    viewports[vp.label] = await auditViewport(page, vp);
  }

  await browser.close();

  const audit = {
    capturedAt: new Date().toISOString(),
    url: OMC,
    viewports,
  };

  writeFileSync(OUT_JSON, JSON.stringify(audit, null, 2));
  writeFileSync(OUT_MD, buildMarkdown(audit));
  console.log(`Wrote ${OUT_JSON}`);
  console.log(`Wrote ${OUT_MD}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
