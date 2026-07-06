/**
 * Deep OMC footer layout audit — desktop 1440 + mobile 390
 * Run: node scripts/audit-omc-footer.mjs
 * Output: scripts/omc-footer-audit.json, FOOTER_AUDIT.md, audit-screenshots/footer/
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
const OUT_JSON = join(__dirname, "omc-footer-audit.json");
const OUT_MD = join(ROOT, "FOOTER_AUDIT.md");
const SHOT_DIR = join(ROOT, "audit-screenshots", "footer");

const VIEWPORTS = [
  { label: "desktop", width: 1440, height: 900 },
  { label: "mobile", width: 390, height: 844 },
];

/** @param {import('playwright').ElementHandle | null} el */
async function probeEl(el) {
  if (!el) return null;
  return el.evaluate((node) => {
    const s = getComputedStyle(node);
    const r = node.getBoundingClientRect();
    return {
      tag: node.tagName.toLowerCase(),
      className: (node.className?.toString?.() || "").slice(0, 200),
      text: (node.textContent || "").trim().slice(0, 80),
      width: Math.round(r.width),
      height: Math.round(r.height),
      top: Math.round(r.top),
      left: Math.round(r.left),
      padding: `${s.paddingTop} ${s.paddingRight} ${s.paddingBottom} ${s.paddingLeft}`,
      margin: `${s.marginTop} ${s.marginRight} ${s.marginBottom} ${s.marginLeft}`,
      gap: s.gap,
      rowGap: s.rowGap,
      columnGap: s.columnGap,
      display: s.display,
      flexDirection: s.flexDirection,
      flexWrap: s.flexWrap,
      justifyContent: s.justifyContent,
      alignItems: s.alignItems,
      gridTemplateColumns: s.gridTemplateColumns,
      gridTemplateRows: s.gridTemplateRows,
      fontSize: s.fontSize,
      fontWeight: s.fontWeight,
      lineHeight: s.lineHeight,
      letterSpacing: s.letterSpacing,
      textTransform: s.textTransform,
      color: s.color,
      backgroundColor: s.backgroundColor,
      borderTop: s.borderTop,
      borderRadius: s.borderRadius,
      opacity: s.opacity,
      maxWidth: s.maxWidth,
      transition: s.transition,
    };
  });
}

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
async function auditFooter(page, viewport) {
  await page.goto(OMC, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForTimeout(3000);
  await dismissOverlays(page);

  await page.evaluate(() => {
    const footer = document.querySelector("footer");
    if (footer) footer.scrollIntoView({ block: "end", behavior: "instant" });
    else window.scrollTo({ top: document.body.scrollHeight, behavior: "instant" });
  });
  await page.waitForTimeout(1200);

  const data = await page.evaluate(() => {
    function cs(el) {
      if (!el) return null;
      const s = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return {
        tag: el.tagName.toLowerCase(),
        className: (el.className?.toString?.() || "").slice(0, 200),
        text: (el.textContent || "").trim().slice(0, 100),
        width: Math.round(r.width),
        height: Math.round(r.height),
        padding: `${s.paddingTop} ${s.paddingRight} ${s.paddingBottom} ${s.paddingLeft}`,
        margin: `${s.marginTop} ${s.marginRight} ${s.marginBottom} ${s.marginLeft}`,
        gap: s.gap,
        display: s.display,
        flexDirection: s.flexDirection,
        gridTemplateColumns: s.gridTemplateColumns,
        fontSize: s.fontSize,
        fontWeight: s.fontWeight,
        color: s.color,
        backgroundColor: s.backgroundColor,
        borderTop: s.borderTop,
        borderRadius: s.borderRadius,
      };
    }

    const footer =
      document.querySelector("footer.footer") ||
      document.querySelector("footer[class*='footer']") ||
      document.querySelector("footer");

    const blocks =
      footer?.querySelector(".footer__blocks") ||
      footer?.querySelector("[class*='footer__blocks']") ||
      footer?.querySelector(".grid") ||
      footer?.querySelector("[class*='footer__content']");

    const columns = blocks
      ? [
          ...blocks.querySelectorAll(
            ":scope > .footer__block, :scope > [class*='footer__block'], :scope > div"
          ),
        ].filter((el) => el.getBoundingClientRect().height > 20)
      : [];

    const newsletterBlock = columns.find((c) =>
      /sign up|newsletter|register/i.test(c.textContent || "")
    );
    const newsletterInput = footer?.querySelector(
      "input[type='email'], .newsletter input, [class*='newsletter'] input"
    );
    const newsletterBtn = footer?.querySelector(
      "button[type='submit'], .newsletter button, [class*='newsletter'] button"
    );

    const socialLinks = [
      ...(footer?.querySelectorAll(
        "a[href*='facebook'], a[href*='instagram'], a[href*='youtube'], a[href*='tiktok'], .footer__social a, [class*='social'] a"
      ) || []),
    ];

    const paymentIcons = [
      ...(footer?.querySelectorAll(
        ".footer__payment img, .payment-icons img, [class*='payment'] img, .list-payment img, svg.payment"
      ) || []),
    ];

    const bottomBar =
      footer?.querySelector(".footer__copyright, .footer-copyright, [class*='copyright']")?.closest(
        "div"
      ) || footer?.querySelector(".footer__aside, [class*='footer__bottom']");

    const copyright = footer?.querySelector(
      ".copyright, .footer__copyright, [class*='copyright']"
    );

    const linkColumns = columns.filter((c) => {
      const links = c.querySelectorAll("a");
      return links.length >= 3 && !/sign up|newsletter/i.test(c.textContent || "");
    });

    const logoBlock = columns.find((c) => {
      const img = c.querySelector("img, svg");
      const hasFewLinks = c.querySelectorAll("a").length < 3;
      return img && hasFewLinks;
    });

    const headings = columns.map((c) =>
      c.querySelector("h2, .h4, .footer__heading, [class*='heading']")?.textContent?.trim()
    );

    const quickLinks = linkColumns[0]
      ? [...linkColumns[0].querySelectorAll("a")].map((a) => a.textContent?.trim())
      : [];
    const infoLinks = linkColumns[1]
      ? [...linkColumns[1].querySelectorAll("a")].map((a) => a.textContent?.trim())
      : [];

    return {
      footerFound: !!footer,
      footerClass: footer?.className?.toString?.() || null,
      footer: cs(footer),
      blocks: cs(blocks),
      columnCount: columns.length,
      columnWidths: columns.map((c) => Math.round(c.getBoundingClientRect().width)),
      headings: headings.filter(Boolean),
      logoBlock: cs(logoBlock),
      linkColumnSamples: linkColumns.slice(0, 2).map(cs),
      quickLinks: quickLinks.slice(0, 12),
      infoLinks: infoLinks.slice(0, 12),
      newsletter: {
        block: cs(newsletterBlock),
        heading: newsletterBlock
          ?.querySelector("h2, .h4, [class*='heading']")
          ?.textContent?.trim(),
        input: cs(newsletterInput),
        button: cs(newsletterBtn),
        description: newsletterBlock?.querySelector("p")?.textContent?.trim()?.slice(0, 200),
      },
      social: {
        count: socialLinks.length,
        items: socialLinks.slice(0, 8).map((a) => ({
          href: a.getAttribute("href"),
          label: a.getAttribute("aria-label") || a.textContent?.trim(),
          size: cs(a),
          icon: cs(a.querySelector("svg, img, .icon")),
        })),
        row: cs(socialLinks[0]?.parentElement),
      },
      payment: {
        count: paymentIcons.length,
        items: paymentIcons.slice(0, 20).map((el) => ({
          alt: el.getAttribute("alt") || el.getAttribute("aria-label"),
          size: cs(el),
        })),
        row: cs(paymentIcons[0]?.parentElement),
      },
      bottomBar: cs(bottomBar),
      copyright: cs(copyright),
      policyLinks: [
        ...(footer?.querySelectorAll(
          ".footer__copyright a, .footer-copyright a, [class*='copyright'] a, .footer__aside a"
        ) || []),
      ]
        .map((a) => a.textContent?.trim())
        .filter(Boolean)
        .slice(0, 8),
      linkSample: cs(footer?.querySelector(".footer__link, footer a")),
    };
  });

  // Hover probe for footer link
  const linkHover = await (async () => {
    const link = page.locator("footer a").first();
    if ((await link.count()) === 0) return null;
    const before = await probeEl(await link.elementHandle());
    await link.hover({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(300);
    const after = await probeEl(await link.elementHandle());
    return { before, after };
  })();

  mkdirSync(SHOT_DIR, { recursive: true });
  const shotPath = join(SHOT_DIR, `omc-footer-${viewport.label}.png`);
  const footerEl = page.locator("footer").first();
  if ((await footerEl.count()) > 0) {
    await footerEl.screenshot({ path: shotPath });
  } else {
    await page.screenshot({ path: shotPath, fullPage: true });
  }

  return { viewport, data, linkHover, screenshot: shotPath };
}

function buildGapTable(audit) {
  const desktop = audit.viewports.desktop?.data;
  const mobile = audit.viewports.mobile?.data;
  if (!desktop) return "| Area | OMC desktop | ybb (before) | Gap |\n|------|-------------|--------------|-----|\n| — | audit failed | — | — |";

  const rows = [
    ["Footer background", desktop.footer?.backgroundColor, "rgb(23, 23, 23) dark", "verify"],
    ["Footer height", `${desktop.footer?.height}px`, "~200px (3-col only)", "missing logo/social/bottom"],
    ["Main grid columns", desktop.blocks?.gridTemplateColumns || `${desktop.columnCount} cols`, "3-col md:grid-cols-3", "need 4-col + logo"],
    ["Column widths", desktop.columnWidths?.join(", "), "equal thirds", "proportions"],
    ["Blocks padding", desktop.blocks?.padding, "py-10 md:py-16", "match OMC"],
    ["Blocks gap", desktop.blocks?.gap, "md:gap-12", "match OMC"],
    ["Column heading size", desktop.linkColumnSamples?.[0]?.fontSize, "text-sm uppercase", "match"],
    ["Link font size", desktop.linkSample?.fontSize, "text-sm", "match"],
    ["Newsletter input height", desktop.newsletter?.input?.height, "min-h-44px", "match"],
    ["Newsletter input radius", desktop.newsletter?.input?.borderRadius, "rounded-input", "match"],
    ["Newsletter button", desktop.newsletter?.button?.borderRadius, "rounded-button pill", "circle arrow btn"],
    ["Social icon count", String(desktop.social?.count), "0 in footer", "missing"],
    ["Social icon size", desktop.social?.items?.[0]?.icon?.width, "—", "add"],
    ["Payment icon count", String(desktop.payment?.count), "8 text badges", "need SVG row"],
    ["Payment icon height", desktop.payment?.items?.[0]?.size?.height, "h-7 text", "24px SVG"],
    ["Bottom bar border", desktop.bottomBar?.borderTop || desktop.copyright?.borderTop, "border-white/10", "match"],
    ["Copyright font", desktop.copyright?.fontSize, "text-sm center", "text-xs left row"],
    [
      "Link hover",
      audit.linkHover?.after?.transition?.slice(0, 60) || "background-size underline",
      ".interaction-footer-link",
      "aligned",
    ],
    ["Mobile columns", String(mobile?.columnCount ?? "—"), "accordion 3-col", "accordion OK"],
  ];

  return [
    "| Area | OMC desktop | ybb (before) | Gap |",
    "|------|-------------|--------------|-----|",
    ...rows.map((r) => `| ${r[0]} | ${r[1]} | ${r[2]} | ${r[3]} |`),
  ].join("\n");
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const audit = { capturedAt: new Date().toISOString(), url: OMC, viewports: {} };

  for (const vp of VIEWPORTS) {
    const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    const page = await context.newPage();
    console.log(`Auditing footer @ ${vp.label} (${vp.width}px)...`);
    try {
      const result = await auditFooter(page, vp);
      audit.viewports[vp.label] = result;
    } catch (err) {
      audit.viewports[vp.label] = { error: String(err) };
      console.error(vp.label, err);
    }
    await context.close();
  }

  await browser.close();

  writeFileSync(OUT_JSON, JSON.stringify(audit, null, 2));
  console.log("Wrote", OUT_JSON);

  const md = `# OMC Footer Audit

> Generated: ${audit.capturedAt.split("T")[0]}  
> Script: \`scripts/audit-omc-footer.mjs\`  
> JSON: \`scripts/omc-footer-audit.json\`  
> Screenshots: \`audit-screenshots/footer/\`

## Desktop measurements (1440px)

${audit.viewports.desktop?.data ? `
- Footer: ${audit.viewports.desktop.data.footer?.width}×${audit.viewports.desktop.data.footer?.height}px, bg \`${audit.viewports.desktop.data.footer?.backgroundColor}\`
- Grid: \`${audit.viewports.desktop.data.blocks?.gridTemplateColumns || "n/a"}\`, ${audit.viewports.desktop.data.columnCount} columns [${audit.viewports.desktop.data.columnWidths?.join(", ")}]
- Headings: ${audit.viewports.desktop.data.headings?.join(" | ") || "—"}
- Newsletter: "${audit.viewports.desktop.data.newsletter?.heading}" — input ${audit.viewports.desktop.data.newsletter?.input?.height}px, radius ${audit.viewports.desktop.data.newsletter?.input?.borderRadius}
- Social: ${audit.viewports.desktop.data.social?.count} icons
- Payment: ${audit.viewports.desktop.data.payment?.count} icons
- Copyright: ${audit.viewports.desktop.data.copyright?.fontSize}
` : "Desktop audit failed."}

## Mobile measurements (390px)

${audit.viewports.mobile?.data ? `
- Columns: ${audit.viewports.mobile.data.columnCount}
- Footer height: ${audit.viewports.mobile.data.footer?.height}px
` : "Mobile audit failed."}

## Gap table (OMC vs ybb before rebuild)

${buildGapTable(audit)}

## Quick links (OMC)

${audit.viewports.desktop?.data?.quickLinks?.map((l) => `- ${l}`).join("\n") || "—"}

## Information links (OMC)

${audit.viewports.desktop?.data?.infoLinks?.map((l) => `- ${l}`).join("\n") || "—"}

## Payment brands (OMC)

${audit.viewports.desktop?.data?.payment?.items?.map((p) => `- ${p.alt || "icon"}`).join("\n") || "—"}
`;

  writeFileSync(OUT_MD, md);
  console.log("Wrote", OUT_MD);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
