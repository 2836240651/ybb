/**
 * OMC scroll reveal audit — animate-element, data-animate, images, video, text
 * Run: node scripts/audit-omc-scroll-reveal.mjs
 */
import { createRequire } from "module";
import { writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const require = createRequire(import.meta.url);
const { chromium } = require("../../scripts/node_modules/playwright");

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const OMC = "https://www.omctackle.com";
const OUT_JSON = join(__dirname, "omc-scroll-reveal-audit.json");
const OUT_MD = join(ROOT, "SCROLL_REVEAL_AUDIT.md");

async function dismissOverlays(page) {
  try {
    const close = page.locator(
      "button[aria-label*='close' i], button[aria-label*='Close' i]"
    );
    if ((await close.count()) > 0) {
      await close.first().click({ timeout: 2000 });
      await page.waitForTimeout(400);
    }
  } catch {
    /* ignore */
  }
}

function probeEl(el) {
  if (!el) return null;
  const s = getComputedStyle(el);
  const r = el.getBoundingClientRect();
  return {
    tag: el.tagName.toLowerCase(),
    className: (el.className?.toString?.() || "").slice(0, 120),
    dataAnimate: el.getAttribute("data-animate"),
    dataDelay: el.getAttribute("data-animate-delay"),
    dataStagger: el.getAttribute("data-animate-stagger"),
    opacity: s.opacity,
    transform: s.transform,
    transition: s.transition?.slice(0, 120),
    animation: s.animation?.slice(0, 120),
    visibility: s.visibility,
    top: Math.round(r.top),
    inView: r.top < innerHeight * 0.85 && r.bottom > innerHeight * 0.15,
    parentSection: el.closest("section, .shopify-section")?.className?.toString?.().slice(0, 80) || null,
  };
}

async function snapshot(page, label) {
  return page.evaluate((label) => {
    function probeEl(el) {
      if (!el) return null;
      const s = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return {
        tag: el.tagName.toLowerCase(),
        className: (el.className?.toString?.() || "").slice(0, 120),
        dataAnimate: el.getAttribute("data-animate"),
        dataDelay: el.getAttribute("data-animate-delay"),
        dataStagger: el.getAttribute("data-animate-stagger"),
        opacity: s.opacity,
        transform: s.transform,
        transition: s.transition?.slice(0, 120),
        animation: s.animation?.slice(0, 120),
        visibility: s.visibility,
        top: Math.round(r.top),
        inView: r.top < innerHeight * 0.85 && r.bottom > innerHeight * 0.15,
        parentSection:
          el.closest("section, .shopify-section")?.className?.toString?.().slice(0, 80) || null,
      };
    }

    const animateEls = [...document.querySelectorAll("animate-element, [data-animate]")];
    const typeCounts = {};
    for (const el of animateEls) {
      const t = el.getAttribute("data-animate") || el.tagName.toLowerCase();
      typeCounts[t] = (typeCounts[t] || 0) + 1;
    }

    const images = [...document.querySelectorAll("img, picture, video")].filter((el) => {
      const r = el.getBoundingClientRect();
      return r.height > 40 && r.width > 40;
    });

    const imageSamples = images.slice(0, 12).map((img) => {
      const wrap =
        img.closest("animate-element, [data-animate], .media, .card") || img.parentElement;
      return {
        tag: img.tagName.toLowerCase(),
        wrap: probeEl(wrap),
        self: probeEl(img),
      };
    });

    const headings = [...document.querySelectorAll("h1, h2, h3, .heading, split-words")].slice(0, 12);
    const headingSamples = headings.map((h) => {
      const animate = h.closest("[data-animate]") || h.querySelector("[data-animate], animate-element");
      return {
        text: (h.textContent || "").trim().slice(0, 60),
        self: probeEl(h),
        animateChild: probeEl(animate),
        hasSplitWords: !!h.querySelector("split-words, .split-words"),
      };
    });

    const cssRules = [];
    for (const sheet of [...document.styleSheets]) {
      try {
        for (const rule of sheet.cssRules || []) {
          const t = rule.cssText || "";
          if (
            /\[data-animate|animate-element|fade-up|zoom-out|zoom-in|clip-up|reveal|split-words/.test(
              t
            ) &&
            cssRules.length < 40
          ) {
            cssRules.push(t.slice(0, 280));
          }
        }
      } catch {
        /* cross-origin */
      }
    }

    const inViewAnimated = animateEls
      .filter((el) => {
        const r = el.getBoundingClientRect();
        return r.top < innerHeight * 0.9 && r.bottom > 0;
      })
      .slice(0, 20)
      .map(probeEl);

    return {
      label,
      scrollY: Math.round(scrollY),
      viewportH: innerHeight,
      animateCount: animateEls.length,
      typeCounts,
      inViewAnimated,
      imageSamples,
      headingSamples,
      cssRules,
    };
  }, label);
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(OMC, { waitUntil: "domcontentloaded", timeout: 120000 });
await page.waitForTimeout(4000);
await dismissOverlays(page);

const scrollSteps = [
  { label: "top", y: 0 },
  { label: "hero-bottom", y: 0.55 },
  { label: "mid", y: 1.2 },
  { label: "lower", y: 2.0 },
  { label: "bottom", y: 3.5 },
];

const snapshots = [];
for (const step of scrollSteps) {
  await page.evaluate((ratio) => {
    window.scrollTo({ top: window.innerHeight * ratio, behavior: "instant" });
  }, step.y);
  await page.waitForTimeout(step.y === 0 ? 500 : 1000);
  snapshots.push(await snapshot(page, step.label));
}

// Scroll one section into view and capture before/after
const sectionProbe = await page.evaluate(async () => {
  const target = document.querySelector(
    "section:not(.header-section) animate-element, section:not(.header-section) [data-animate]"
  );
  if (!target) return null;
  const before = {
    opacity: getComputedStyle(target).opacity,
    transform: getComputedStyle(target).transform,
    dataAnimate: target.getAttribute("data-animate"),
  };
  target.scrollIntoView({ block: "center" });
  await new Promise((r) => setTimeout(r, 1200));
  const after = {
    opacity: getComputedStyle(target).opacity,
    transform: getComputedStyle(target).transform,
    animation: getComputedStyle(target).animation?.slice(0, 120),
    transition: getComputedStyle(target).transition?.slice(0, 120),
  };
  return { before, after, className: target.className?.toString?.().slice(0, 120) };
});

const audit = {
  capturedAt: new Date().toISOString(),
  url: OMC,
  viewport: { width: 1440, height: 900 },
  snapshots,
  sectionProbe,
};

writeFileSync(OUT_JSON, JSON.stringify(audit, null, 2));

const typeSummary = {};
for (const s of snapshots) {
  for (const [k, v] of Object.entries(s.typeCounts || {})) {
    typeSummary[k] = Math.max(typeSummary[k] || 0, v);
  }
}

const md = `# OMC Scroll Reveal Audit

> Generated: ${audit.capturedAt.split("T")[0]}  
> Script: \`scripts/audit-omc-scroll-reveal.mjs\`  
> JSON: \`scripts/omc-scroll-reveal-audit.json\`

## data-animate type counts (max per scroll position)

| Type | Count |
|------|-------|
${Object.entries(typeSummary)
  .sort((a, b) => b[1] - a[1])
  .map(([k, v]) => `| \`${k}\` | ${v} |`)
  .join("\n")}

## Section scroll-into-view probe

${sectionProbe ? `| State | opacity | transform |
|-------|---------|-----------|
| before | ${sectionProbe.before.opacity} | ${(sectionProbe.before.transform || "none").slice(0, 40)} |
| after | ${sectionProbe.after.opacity} | ${(sectionProbe.after.transform || "none").slice(0, 40)} |

- \`data-animate\`: ${sectionProbe.before.dataAnimate ?? "—"}
- after animation: ${sectionProbe.after.animation || "none"}
- after transition: ${sectionProbe.after.transition || "none"}` : "_No target found_"}

## In-view animated samples (mid scroll)

${snapshots.find((s) => s.label === "mid")?.inViewAnimated?.slice(0, 8).map((el) => `- \`${el.dataAnimate || el.tag}\` opacity=${el.opacity} transform=${(el.transform || "none").slice(0, 35)} delay=${el.dataDelay ?? "—"}`).join("\n") ?? "—"}

## CSS rules (sample)

\`\`\`css
${(snapshots[0]?.cssRules || []).slice(0, 8).join("\n")}
\`\`\`
`;

writeFileSync(OUT_MD, md);
console.log("Wrote", OUT_JSON);
console.log("Types:", typeSummary);
await browser.close();
