/**
 * OMC homepage hero/slideshow audit — layout, typography, gradient, nav
 * Run: node scripts/audit-omc-hero.mjs
 * Output: scripts/omc-hero-audit.json, HERO_CAROUSEL_AUDIT.md (root)
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
const OUT_JSON = join(__dirname, "omc-hero-audit.json");
const OUT_MD = join(ROOT, "HERO_CAROUSEL_AUDIT.md");
const SHOT_DIR = join(ROOT, "audit-screenshots", "hero");

const VIEWPORTS = [
  { label: "desktop-1440", width: 1440, height: 900 },
  { label: "mobile-390", width: 390, height: 844 },
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
async function measurePage(page, viewportLabel) {
  return page.evaluate((viewportLabel) => {
  function probeEl(el) {
  if (!el) return null;
  const s = getComputedStyle(el);
  const r = el.getBoundingClientRect();
  return {
    tag: el.tagName.toLowerCase(),
    class: (el.className?.toString?.() || "").slice(0, 200),
    text: (el.textContent || "").trim().slice(0, 120),
    rect: {
      w: Math.round(r.width),
      h: Math.round(r.height),
      l: Math.round(r.left),
      t: Math.round(r.top),
      r: Math.round(r.right),
      b: Math.round(r.bottom),
    },
    typography: {
      fontSize: s.fontSize,
      fontWeight: s.fontWeight,
      letterSpacing: s.letterSpacing,
      lineHeight: s.lineHeight,
      textTransform: s.textTransform,
      textAlign: s.textAlign,
      color: s.color,
      fontFamily: s.fontFamily?.slice(0, 80),
    },
    layout: {
      position: s.position,
      display: s.display,
      justifyContent: s.justifyContent,
      alignItems: s.alignItems,
      padding: `${s.paddingTop} ${s.paddingRight} ${s.paddingBottom} ${s.paddingLeft}`,
      margin: `${s.marginTop} ${s.marginRight} ${s.marginBottom} ${s.marginLeft}`,
      maxWidth: s.maxWidth,
    },
    visual: {
      borderRadius: s.borderRadius,
      background: s.background?.slice(0, 200),
      backgroundImage: s.backgroundImage?.slice(0, 300),
      opacity: s.opacity,
      transform: s.transform,
      boxShadow: s.boxShadow?.slice(0, 120),
    },
    zIndex: s.zIndex,
  };
}

  const viewport = { label: viewportLabel };
  const vw = window.innerWidth;
    const root = getComputedStyle(document.documentElement);
    const cssVars = {};
    [
      "--rounded-card",
      "--rounded-block",
      "--border-radius",
      "--hero-section-radius",
      "--hero-slide-gap",
      "--gap-padding",
      "--title-sm",
      "--title-md",
      "--title-lg",
      "--title-xl",
      "--animation-smooth",
    ].forEach((v) => {
      cssVars[v] = root.getPropertyValue(v).trim();
    });

    const slideshow = document.querySelector("slideshow-element.slideshow, .slideshow");
    const heroSection = document.querySelector("[id*='slideshow']");
    const viewportEl = document.querySelector(".flickity-viewport");
    const slides = [...document.querySelectorAll(".flickity-slider > .banner, .flickity-slider > *")];
    const active =
      slides.find((s) => s.classList.contains("is-selected")) || slides[0];
    const next = slides[(slides.indexOf(active) + 1) % slides.length];

    const overlay = active?.querySelector(".banner__overlay");
    const words = document.querySelector("slideshow-words, .slideshow-words");
    const activeWord =
      words?.querySelector('[aria-current="true"], .slideshow-word[aria-current="true"]') ||
      words?.querySelector(".slideshow-word");
    const heading =
      activeWord?.querySelector("h2, h1, .banner__heading, p") ||
      active?.querySelector("h2, h1, .banner__heading");
    const cta = activeWord?.querySelector("a.button, .button, a[href]");

    const controls = document.querySelector(".slideshow__controls, .page-width:has(.flickity-page-dot)");
    const dots = [...document.querySelectorAll(".flickity-page-dot")];
    const activeDot = dots.find((d) => d.classList.contains("is-selected")) || dots[0];
    const prevBtn = document.querySelector("[aria-label='Previous'], [aria-label='Previous slide']");
    const nextBtn = document.querySelector("[aria-label='Next'], [aria-label='Next slide']");

    // Peek analysis
    let peek = null;
    if (active && next && active !== next) {
      const rA = active.getBoundingClientRect();
      const rN = next.getBoundingClientRect();
      const gap = Math.round(rN.left - rA.right);
      peek = {
        activeWidth: Math.round(rA.width),
        activeLeft: Math.round(rA.left),
        activeRight: Math.round(rA.right),
        nextVisiblePx: Math.round(Math.max(0, Math.min(rN.right, vw) - Math.max(rN.left, 0))),
        gapPx: gap,
        viewportWidth: vw,
        activePctOfViewport: Math.round((rA.width / vw) * 100),
        hasPeek: rN.left < vw && rN.left < rA.right + 5,
      };
    }

    // Slide gap from Flickity
    let slideGap = null;
    if (slides.length >= 2) {
      const r0 = slides[0].getBoundingClientRect();
      const r1 = slides[1].getBoundingClientRect();
      slideGap = Math.round(r1.left - r0.right);
    }

    const slideshowAttrs = {
      autoplay: slideshow?.getAttribute?.("autoplay"),
      autoplaySpeed: slideshow?.getAttribute?.("autoplay-speed"),
      class: slideshow?.className?.toString?.().slice(0, 200),
    };

    return {
      viewport: { w: vw, h: window.innerHeight, label: viewport.label },
      cssVars,
      slideshowAttrs,
      slideCount: slides.length,
      peek,
      slideGap,
      heroSection: probeEl(heroSection),
      slideshow: probeEl(slideshow),
      flickityViewport: probeEl(viewportEl),
      activeSlide: probeEl(active),
      overlay: probeEl(overlay),
      wordsContainer: probeEl(words),
      activeWord: probeEl(activeWord),
      heading: probeEl(heading),
      cta: probeEl(cta),
      controls: probeEl(controls),
      dot: probeEl(activeDot),
      dotInner: probeEl(activeDot?.querySelector("span, .dot") || activeDot),
      prevBtn: probeEl(prevBtn),
      nextBtn: probeEl(nextBtn),
      slideTexts: slides.map((s, i) => {
        const w = words?.querySelectorAll?.(".slideshow-word")?.[i];
        const h = w?.querySelector("h2, h1, p");
        return {
          index: i,
          isSelected: s.classList.contains("is-selected"),
          headingText: (h?.textContent || "").trim().slice(0, 100),
          hasCta: !!w?.querySelector("a.button, .button"),
        };
      }),
    };
  }, viewportLabel);
}

/** @param {import('playwright').Page} page */
async function auditViewport(page, viewport) {
  await page.setViewportSize({ width: viewport.width, height: viewport.height });
  await page.goto(OMC, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForTimeout(4000);
  await dismissOverlays(page);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await page.waitForTimeout(500);

  mkdirSync(SHOT_DIR, { recursive: true });
  await page.screenshot({
    path: join(SHOT_DIR, `omc-hero-${viewport.label}.png`),
    clip: { x: 0, y: 0, width: viewport.width, height: Math.min(900, viewport.height) },
  });

  return measurePage(page, viewport.label);
}

function mdSection(data) {
  const d = data["desktop-1440"];
  const m = data["mobile-390"];
  if (!d) return "# Hero audit\n\nNo data.\n";

  return `# Hero Carousel Audit — OMC vs YBB

> **Generated**: ${new Date().toISOString().slice(0, 10)}  
> **Script**: \`scripts/audit-omc-hero.mjs\`  
> **Benchmark**: https://www.omctackle.com  
> **Raw data**: \`scripts/omc-hero-audit.json\`

---

## 1. OMC crawl measurements (@ 1440px)

| Property | OMC measured |
|----------|--------------|
| Autoplay | \`${d.slideshowAttrs?.autoplaySpeed || d.slideshowAttrs?.autoplay || "7"}s\` |
| Slide count | ${d.slideCount} |
| Active slide size | ${d.activeSlide?.rect?.w}×${d.activeSlide?.rect?.h}px |
| Border radius | ${d.activeSlide?.visual?.borderRadius} |
| Peek carousel | ${d.peek?.hasPeek ? `yes — active ${d.peek.activePctOfViewport}% viewport, gap ${d.peek.gapPx}px` : "no — full width"} |
| Slide gap | ${d.slideGap ?? "n/a"}px |
| Overlay background | \`${(d.overlay?.visual?.backgroundImage || d.overlay?.visual?.background || "none").slice(0, 120)}\` |
| Heading text | "${d.heading?.text || "n/a"}" |
| Heading font-size | ${d.heading?.typography?.fontSize} |
| Heading font-weight | ${d.heading?.typography?.fontWeight} |
| Heading text-transform | ${d.heading?.typography?.textTransform} |
| Heading text-align | ${d.heading?.typography?.textAlign} |
| Heading position | bottom ${d.activeSlide?.rect?.b && d.heading?.rect?.b ? d.activeSlide.rect.b - d.heading.rect.b : "n/a"}px from slide bottom |
| Words container align | ${d.wordsContainer?.layout?.justifyContent} / ${d.wordsContainer?.typography?.textAlign} |
| Dot style | ${d.dot?.rect?.w}×${d.dot?.rect?.h}px, radius ${d.dot?.visual?.borderRadius} |
| Prev/Next btn | ${d.prevBtn?.rect?.w}×${d.prevBtn?.rect?.h}px |

### Mobile (@ 390px)

| Property | Value |
|----------|-------|
| Slide height | ${m?.activeSlide?.rect?.h}px |
| Heading font-size | ${m?.heading?.typography?.fontSize} |
| Peek | ${m?.peek?.hasPeek ? "yes" : "no"} |

### Per-slide copy (OMC)

${(d.slideTexts || [])
  .map((s) => `- Slide ${s.index + 1}${s.isSelected ? " (active)" : ""}: "${s.headingText}"${s.hasCta ? " + CTA" : ""}`)
  .join("\n")}

---

## 2. YBB gaps (before fix)

| Issue | YBB (wrong) | OMC (target) |
|-------|-------------|--------------|
| Text layout | Left column: eyebrow + H2 + subtitle + pill CTA | Centered bottom caption, single headline |
| Gradient | Full left-to-right dark overlay | Bottom-third linear gradient only |
| Typography | \`text-title-xl\` (80px+ desktop) | ~48.5px bold, uppercase |
| Peek slides | \`basis-full\`, no adjacent peek | ${d.peek?.hasPeek ? "Center slide + side peek" : "Full width centered"} |

---

## 3. YBB implementation mapping

See \`components/home/HeroCarousel.tsx\` and \`app/globals.css\` hero tokens.

`;
}

const browser = await chromium.launch({ headless: true });
const results = {};

for (const vp of VIEWPORTS) {
  const page = await browser.newPage();
  results[vp.label] = await auditViewport(page, vp);
  await page.close();
}

await browser.close();

writeFileSync(OUT_JSON, JSON.stringify(results, null, 2));
writeFileSync(OUT_MD, mdSection(results));
console.log(`Wrote ${OUT_JSON}`);
console.log(`Wrote ${OUT_MD}`);
