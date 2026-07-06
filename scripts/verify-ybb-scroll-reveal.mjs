import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { chromium } = require("../../scripts/node_modules/playwright");

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto("http://localhost:3001", { waitUntil: "networkidle" });

const beforeScroll = await page.evaluate(() => ({
  total: document.querySelectorAll("[data-scroll-reveal]").length,
  visible: document.querySelectorAll(".scroll-reveal--visible").length,
  belowFoldHidden: [...document.querySelectorAll("[data-scroll-reveal]")].filter((el) => {
    const r = el.getBoundingClientRect();
    return r.top > innerHeight && !el.classList.contains("scroll-reveal--visible");
  }).length,
}));

await page.evaluate(() => window.scrollTo(0, window.innerHeight * 1.5));
await page.waitForTimeout(1200);

const afterScroll = await page.evaluate(() => ({
  visible: document.querySelectorAll(".scroll-reveal--visible").length,
  videoRevealed: !!document.querySelector(".scroll-reveal--visible[data-scroll-reveal='zoom-out']"),
  headingRevealed: !!document.querySelector(".scroll-reveal--visible[data-scroll-reveal='fade-up-large']"),
}));

console.log(JSON.stringify({ beforeScroll, afterScroll }, null, 2));
await browser.close();
