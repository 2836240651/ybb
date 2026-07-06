import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { chromium } = require("../../scripts/node_modules/playwright");

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto("https://www.omctackle.com", { waitUntil: "domcontentloaded", timeout: 120000 });
await page.waitForTimeout(3000);

const rules = await page.evaluate(() => {
  const out = [];
  for (const sheet of [...document.styleSheets]) {
    try {
      for (const rule of sheet.cssRules || []) {
        const t = rule.cssText || "";
        if (
          t.includes("data-animate") ||
          (t.includes("@keyframes") && /fade|zoom|clip/.test(t)) ||
          t.includes("animate-element.animated")
        ) {
          out.push(t);
        }
      }
    } catch {
      /* cross-origin */
    }
  }
  return out;
});

for (const r of rules) console.log(r, "\n---");

await browser.close();
