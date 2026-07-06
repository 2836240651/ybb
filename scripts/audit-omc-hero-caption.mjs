/**
 * OMC hero caption animation probe — run on slide change
 * node scripts/audit-omc-hero-caption.mjs
 */
import { createRequire } from "module";
import { writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const require = createRequire(import.meta.url);
const { chromium } = require("../../scripts/node_modules/playwright");

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "omc-hero-caption-animation.json");
const OMC = "https://www.omctackle.com";

function probe(el) {
  if (!el) return null;
  const s = getComputedStyle(el);
  const r = el.getBoundingClientRect();
  return {
    tag: el.tagName.toLowerCase(),
    class: (el.className?.toString?.() || "").slice(0, 160),
    text: (el.textContent || "").trim().slice(0, 80),
    opacity: s.opacity,
    transform: s.transform,
    transition: s.transition?.slice(0, 120),
    animation: s.animation?.slice(0, 120),
    ariaCurrent: el.getAttribute?.("aria-current"),
  };
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(OMC, { waitUntil: "domcontentloaded", timeout: 120000 });
await page.waitForTimeout(5000);

const timeline = [];

async function snapshot(label) {
  return page.evaluate((label) => {
    function probe(el) {
      if (!el) return null;
      const s = getComputedStyle(el);
      return {
        tag: el.tagName.toLowerCase(),
        class: (el.className?.toString?.() || "").slice(0, 160),
        text: (el.textContent || "").trim().slice(0, 80),
        opacity: s.opacity,
        transform: s.transform,
        transition: s.transition?.slice(0, 120),
        animation: s.animation?.slice(0, 120),
        ariaCurrent: el.getAttribute?.("aria-current"),
        dataAnimate: el.getAttribute?.("data-animate"),
        dataAnimateDelay: el.getAttribute?.("data-animate-delay"),
      };
    }

    const words = document.querySelector("slideshow-words, .slideshow-words");
    const items = [...(words?.children || [])];
    const active = items.find((w) => w.getAttribute("aria-current") === "true");
    const animateEls = [...(active?.querySelectorAll("animate-element") || [])];
    const heading = active?.querySelector("h1, h2, .heading, split-words");

    return {
      label,
      time: Date.now(),
      selectedIndex: words?.getAttribute?.("selected-index"),
      items: items.map((item) => ({
        ariaCurrent: item.getAttribute("aria-current"),
        text: (item.textContent || "").trim().slice(0, 60),
        animateCount: item.querySelectorAll("animate-element").length,
        splitWords: !!item.querySelector("split-words"),
        heading: probe(item.querySelector("h1, h2, .heading")),
        firstAnimate: probe(item.querySelector("animate-element")),
      })),
      activeAnimateEls: animateEls.slice(0, 5).map(probe),
      heading: probe(heading),
    };
  }, label);
}

timeline.push(await snapshot("idle-0"));

const nextBtn = page.locator("[aria-label='Next'], [aria-label='Next slide']").first();
await nextBtn.click();
for (const delay of [0, 50, 100, 200, 350, 500, 650, 800, 1000, 1500]) {
  await page.waitForTimeout(delay === 0 ? 0 : delay - (timeline.length > 1 ? [0, 50, 100, 200, 350, 500, 650, 800, 1000, 1500][timeline.length - 2] : 0));
  timeline.push(await snapshot(`after-next+${delay}ms`));
}

// Second click for another transition sample
await nextBtn.click();
for (const delay of [0, 100, 300, 500, 800, 1200]) {
  await page.waitForTimeout(delay === 0 ? 300 : delay - ([0, 100, 300, 500, 800, 1200][timeline.length % 6 - 1] || 0));
  timeline.push(await snapshot(`after-next2+${delay}ms`));
}

const staticInfo = await page.evaluate(() => {
  const words = document.querySelector("slideshow-words");
  const active = words?.querySelector('[aria-current="true"]');
  const split = active?.querySelector("split-words");
  const firstAnim = active?.querySelector("animate-element");
  return {
    wordsAttrs: {
      selectedIndex: words?.getAttribute("selected-index"),
      ariaControls: words?.getAttribute("aria-controls"),
    },
    splitWordsAttrs: {
      dataAnimate: split?.getAttribute("data-animate"),
      dataAnimateDelay: split?.getAttribute("data-animate-delay"),
      class: split?.className?.toString?.(),
    },
    animateElementAttrs: {
      dataAnimate: firstAnim?.getAttribute("data-animate"),
      dataAnimateDelay: firstAnim?.getAttribute("data-animate-delay"),
      class: firstAnim?.className?.toString?.(),
    },
    cssRules: [...document.styleSheets]
      .flatMap((ss) => {
        try {
          return [...ss.cssRules];
        } catch {
          return [];
        }
      })
      .map((r) => r.cssText)
      .filter((t) => /slideshow-word|split-words|animate-element|data-animate/i.test(t))
      .slice(0, 30),
  };
});

await browser.close();

const result = { staticInfo, timeline };
writeFileSync(OUT, JSON.stringify(result, null, 2));
console.log("Wrote", OUT);
console.log("splitWords data-animate:", staticInfo.splitWordsAttrs?.dataAnimate);
console.log("timeline samples:", timeline.length);
