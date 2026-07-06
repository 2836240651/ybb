/**
 * OMC footer newsletter + chat widget deep crawl
 * Run: node scripts/audit-omc-newsletter-chat.mjs
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
const OUT_JSON = join(__dirname, "omc-newsletter-chat-audit.json");
const OUT_MD = join(ROOT, "NEWSLETTER_CHAT_AUDIT.md");
const SHOT_DIR = join(ROOT, "audit-screenshots", "newsletter-chat");

function cs(el) {
  if (!el) return null;
  const s = getComputedStyle(el);
  const r = el.getBoundingClientRect();
  return {
    tag: el.tagName.toLowerCase(),
    id: el.id || null,
    className: (el.className?.toString?.() || "").slice(0, 240),
    text: (el.textContent || "").trim().slice(0, 120),
    width: Math.round(r.width),
    height: Math.round(r.height),
    padding: `${s.paddingTop} ${s.paddingRight} ${s.paddingBottom} ${s.paddingLeft}`,
    margin: `${s.marginTop} ${s.marginRight} ${s.marginBottom} ${s.marginLeft}`,
    gap: s.gap,
    display: s.display,
    flexDirection: s.flexDirection,
    alignItems: s.alignItems,
    justifyContent: s.justifyContent,
    fontSize: s.fontSize,
    fontWeight: s.fontWeight,
    lineHeight: s.lineHeight,
    letterSpacing: s.letterSpacing,
    textTransform: s.textTransform,
    color: s.color,
    backgroundColor: s.backgroundColor,
    border: s.border,
    borderRadius: s.borderRadius,
    boxShadow: s.boxShadow,
    transition: s.transition,
    position: s.position,
    bottom: s.bottom,
    right: s.right,
    zIndex: s.zIndex,
  };
}

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

async function crawlNewsletter(page) {
  await page.evaluate(() => {
    const footer = document.querySelector("footer");
    footer?.scrollIntoView({ block: "end" });
  });
  await page.waitForTimeout(800);

  return page.evaluate(() => {
    function cs(el) {
      if (!el) return null;
      const s = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return {
        tag: el.tagName.toLowerCase(),
        className: (el.className?.toString?.() || "").slice(0, 240),
        text: (el.textContent || "").trim().slice(0, 120),
        width: Math.round(r.width),
        height: Math.round(r.height),
        padding: `${s.paddingTop} ${s.paddingRight} ${s.paddingBottom} ${s.paddingLeft}`,
        margin: `${s.marginTop} ${s.marginRight} ${s.marginBottom} ${s.marginLeft}`,
        gap: s.gap,
        display: s.display,
        fontSize: s.fontSize,
        fontWeight: s.fontWeight,
        lineHeight: s.lineHeight,
        letterSpacing: s.letterSpacing,
        textTransform: s.textTransform,
        color: s.color,
        backgroundColor: s.backgroundColor,
        border: s.border,
        borderRadius: s.borderRadius,
        boxShadow: s.boxShadow,
        transition: s.transition,
      };
    }

    const footer = document.querySelector("footer");
    const signupBlock = [...(footer?.querySelectorAll("*") || [])].find((el) =>
      /sign up|newsletter/i.test(el.textContent || "")
    );
    const block =
      signupBlock?.closest(".footer__block, [class*='footer__block'], .grid__item, div") ||
      footer?.querySelector("[class*='newsletter'], .newsletter");

    const form = block?.querySelector("form") || footer?.querySelector("form");
    const input =
      form?.querySelector("input[type='email']") ||
      block?.querySelector("input[type='email']");
    const btn =
      form?.querySelector("button[type='submit'], button") ||
      block?.querySelector("button");
    const heading = block?.querySelector("h2, h3, .h4, [class*='heading']");
    const desc = block?.querySelector("p, .rte p");

    const socialRow = block?.querySelector(
      "[class*='social'], .footer__social, .list-social"
    );
    const socialLinks = [
      ...(socialRow?.querySelectorAll("a") ||
        footer?.querySelectorAll(
          "a[href*='facebook'], a[href*='instagram'], a[href*='youtube'], a[href*='tiktok']"
        ) ||
        []),
    ];

    return {
      blockHtml: block?.outerHTML?.slice(0, 4000) || null,
      heading: heading?.textContent?.trim() || null,
      description: desc?.textContent?.trim() || null,
      form: form
        ? {
            action: form.getAttribute("action"),
            method: form.getAttribute("method"),
            id: form.id,
            className: form.className?.toString?.(),
            dataAttrs: [...form.attributes]
              .filter((a) => a.name.startsWith("data-"))
              .map((a) => ({ name: a.name, value: a.value })),
          }
        : null,
      input: input
        ? {
            type: input.getAttribute("type"),
            name: input.getAttribute("name"),
            placeholder: input.getAttribute("placeholder"),
            ariaLabel: input.getAttribute("aria-label"),
            autocomplete: input.getAttribute("autocomplete"),
            required: input.required,
            wrapperClass: input.parentElement?.className?.toString?.(),
          }
        : null,
      button: btn
        ? {
            type: btn.getAttribute("type"),
            ariaLabel: btn.getAttribute("aria-label"),
            innerHTML: btn.innerHTML.slice(0, 500),
          }
        : null,
      styles: {
        block: cs(block),
        heading: cs(heading),
        desc: cs(desc),
        form: cs(form),
        input: cs(input),
        inputWrapper: cs(input?.parentElement),
        button: cs(btn),
        socialRow: cs(socialRow),
      },
      social: socialLinks.slice(0, 6).map((a) => ({
        href: a.getAttribute("href"),
        ariaLabel: a.getAttribute("aria-label"),
        className: a.className?.toString?.(),
        iconHtml: a.querySelector("svg, .icon")?.outerHTML?.slice(0, 400),
        size: cs(a),
      })),
    };
  });
}

async function crawlChat(page) {
  // Collect third-party chat scripts
  const scripts = await page.evaluate(() =>
    [...document.querySelectorAll("script[src]")].map((s) => s.getAttribute("src")).filter(Boolean)
  );
  const chatScripts = scripts.filter((s) =>
    /chat|inbox|gorgias|tidio|crisp|intercom|zendesk|shopify.*chat|shopify.*inbox/i.test(s || "")
  );

  // Find launcher buttons
  const launcherSelectors = [
    "#shopify-chat-button",
    "[id*='shopify-chat']",
    "[class*='shopify-chat']",
    "[class*='inbox']",
    "button[aria-label*='chat' i]",
    "button[aria-label*='Chat' i]",
    "[data-testid*='chat']",
    ".needsclick",
    "iframe[title*='chat' i]",
    "iframe[src*='chat' i]",
    "iframe[src*='inbox' i]",
  ];

  let launcher = null;
  for (const sel of launcherSelectors) {
    const loc = page.locator(sel).first();
    if ((await loc.count()) > 0) {
      launcher = { selector: sel, ...(await loc.evaluate((el) => ({
        tag: el.tagName.toLowerCase(),
        id: el.id,
        className: el.className?.toString?.(),
        ariaLabel: el.getAttribute("aria-label"),
        text: (el.textContent || "").trim().slice(0, 80),
        rect: (() => {
          const r = el.getBoundingClientRect();
          return { width: Math.round(r.width), height: Math.round(r.height), bottom: Math.round(r.bottom), right: Math.round(r.right) };
        })(),
      }))) };
      break;
    }
  }

  // Try click chat launcher
  let panel = null;
  const clickTarget =
    page.locator("#shopify-chat-button").first().or(page.locator("button").filter({ hasText: /chat/i }).first());

  if ((await clickTarget.count()) > 0) {
    try {
      await clickTarget.click({ timeout: 5000 });
      await page.waitForTimeout(2000);
    } catch {
      /* ignore */
    }
  }

  panel = await page.evaluate(() => {
    function cs(el) {
      if (!el) return null;
      const s = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return {
        width: Math.round(r.width),
        height: Math.round(r.height),
        bottom: s.bottom,
        right: s.right,
        position: s.position,
        zIndex: s.zIndex,
        backgroundColor: s.backgroundColor,
        borderRadius: s.borderRadius,
        boxShadow: s.boxShadow,
      };
    }

    const candidates = [
      "#shopify-chat-panel",
      "[id*='shopify-chat-panel']",
      "[class*='shopify-chat']",
      "[role='dialog']",
      "iframe[title*='chat' i]",
      "iframe[src*='chat' i]",
      "iframe[src*='inbox' i]",
    ];
    let panelEl = null;
    for (const sel of candidates) {
      const el = document.querySelector(sel);
      if (el && el.getBoundingClientRect().height > 40) {
        panelEl = el;
        break;
      }
    }

    const iframes = [...document.querySelectorAll("iframe")].map((f) => ({
      src: f.getAttribute("src"),
      title: f.getAttribute("title"),
      id: f.id,
      className: f.className?.toString?.(),
      size: cs(f),
    }));

    const shopifyChatRoot = document.querySelector("#shopify-chat, shopify-chat, [data-shopify-chat]");
    const shopifyConfig = (() => {
      const w = window;
      const keys = Object.keys(w).filter((k) =>
        /chat|inbox|shopify/i.test(k)
      );
      const snippets = {};
      for (const k of keys.slice(0, 30)) {
        try {
          const v = w[k];
          if (v && typeof v === "object") snippets[k] = JSON.stringify(v).slice(0, 500);
          else if (typeof v === "string") snippets[k] = v.slice(0, 200);
        } catch {
          /* ignore */
        }
      }
      return snippets;
    })();

    // Messages visible in DOM (non-iframe)
    const messageBubbles = [...document.querySelectorAll("[class*='message'], [class*='bubble'], [class*='chat'] p")]
      .filter((el) => el.getBoundingClientRect().height > 10)
      .slice(0, 12)
      .map((el) => ({
        text: (el.textContent || "").trim().slice(0, 200),
        className: el.className?.toString?.().slice(0, 120),
        style: cs(el),
      }));

    return {
      panelFound: !!panelEl,
      panelTag: panelEl?.tagName?.toLowerCase() || null,
      panelId: panelEl?.id || null,
      panelClass: panelEl?.className?.toString?.() || null,
      panelStyle: cs(panelEl),
      panelHtml: panelEl?.outerHTML?.slice(0, 3000) || null,
      iframes,
      shopifyChatRoot: shopifyChatRoot
        ? { tag: shopifyChatRoot.tagName.toLowerCase(), id: shopifyChatRoot.id, className: shopifyChatRoot.className?.toString?.() }
        : null,
      shopifyWindowKeys: Object.keys(window).filter((k) => /shopify.*chat|chat.*shopify|inbox/i.test(k)),
      shopifyConfig,
      messageBubbles,
      localStorageKeys: Object.keys(localStorage).filter((k) => /chat|inbox|shopify/i.test(k)),
    };
  });

  // Probe iframe content if Shopify Inbox
  let iframeContent = null;
  const iframe = page.frameLocator("iframe[title*='chat' i], iframe[src*='inbox' i], iframe[src*='chat' i]").first();
  if ((await page.locator("iframe[title*='chat' i], iframe[src*='inbox' i], iframe[src*='chat' i]").count()) > 0) {
    try {
      iframeContent = {
        title: await iframe.locator("body").evaluate(() => document.title).catch(() => null),
        headings: await iframe.locator("h1, h2, [class*='header']").first().textContent().catch(() => null),
        inputs: await iframe.locator("input, textarea").count().catch(() => 0),
        buttons: await iframe.locator("button").count().catch(() => 0),
        sampleText: await iframe.locator("body").evaluate(() => (document.body?.innerText || "").slice(0, 800)).catch(() => null),
      };
    } catch {
      iframeContent = { error: "cross-origin or not loaded" };
    }
  }

  return {
    chatScripts,
    launcher,
    panel,
    iframeContent,
    allScriptCount: scripts.length,
  };
}

async function main() {
  mkdirSync(SHOT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  const networkLog = [];
  page.on("request", (req) => {
    const url = req.url();
    if (/newsletter|klaviyo|customer|subscribe|contact|chat|inbox/i.test(url)) {
      networkLog.push({ method: req.method(), url: url.slice(0, 300) });
    }
  });

  console.log("Loading OMC homepage...");
  await page.goto(OMC, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForTimeout(5000);
  await dismissOverlays(page);

  console.log("Crawling newsletter...");
  const newsletter = await crawlNewsletter(page);
  await page.screenshot({ path: join(SHOT_DIR, "omc-footer-newsletter.png"), fullPage: false });

  // Hover newsletter button
  const emailInput = page.locator("footer input[type='email']").first();
  let newsletterFocus = null;
  if ((await emailInput.count()) > 0) {
    await emailInput.focus();
    await page.waitForTimeout(200);
    newsletterFocus = await page.evaluate(() => {
      function cs(el) {
        if (!el) return null;
        const s = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        return {
          border: s.border,
          boxShadow: s.boxShadow,
          outline: s.outline,
          backgroundColor: s.backgroundColor,
          height: Math.round(r.height),
        };
      }
      const input = document.querySelector("footer input[type='email']");
      return cs(input);
    });
  }

  console.log("Crawling chat...");
  const chatBefore = await crawlChat(page);
  await page.screenshot({ path: join(SHOT_DIR, "omc-chat-launcher.png") });

  const audit = {
    capturedAt: new Date().toISOString(),
    url: OMC,
    newsletter: { ...newsletter, inputFocused: newsletterFocus },
    chat: chatBefore,
    networkLog: networkLog.slice(0, 40),
    pageMeta: await page.evaluate(() => ({
      shopify: !!window.Shopify,
      shopDomain: window.Shopify?.shop || null,
      theme: document.querySelector('meta[name="theme-name"]')?.getAttribute("content") || null,
    })),
  };

  await browser.close();
  writeFileSync(OUT_JSON, JSON.stringify(audit, null, 2));
  console.log("Wrote", OUT_JSON);

  const md = `# OMC Newsletter & Chat Audit

> Generated: ${audit.capturedAt.split("T")[0]}  
> Script: \`scripts/audit-omc-newsletter-chat.mjs\`  
> JSON: \`scripts/omc-newsletter-chat-audit.json\`

## 1. Footer Newsletter (OMC SIGN UP)

| Field | OMC |
|-------|-----|
| Heading | ${newsletter.heading || "—"} |
| Description | ${newsletter.description || "—"} |
| Form action | \`${newsletter.form?.action || "—"}\` |
| Form method | ${newsletter.form?.method || "—"} |
| Input name | ${newsletter.input?.name || "—"} |
| Input placeholder | ${newsletter.input?.placeholder || "—"} |
| Button aria | ${newsletter.button?.ariaLabel || "—"} |
| Social count | ${newsletter.social?.length || 0} |

### Computed styles

- Block: ${newsletter.styles?.block?.padding}, gap ${newsletter.styles?.block?.gap}
- Heading: ${newsletter.styles?.heading?.fontSize} / ${newsletter.styles?.heading?.fontWeight} / ${newsletter.styles?.heading?.textTransform}
- Input: ${newsletter.styles?.input?.height}px, radius ${newsletter.styles?.input?.borderRadius}, bg ${newsletter.styles?.input?.backgroundColor}
- Button: ${newsletter.styles?.button?.width}×${newsletter.styles?.button?.height}px, radius ${newsletter.styles?.button?.borderRadius}

## 2. Chat Widget

| Field | OMC |
|-------|-----|
| Chat scripts | ${chatBefore.chatScripts?.join(", ") || "none in src"} |
| Launcher | ${chatBefore.launcher?.selector || "—"} — "${chatBefore.launcher?.text || chatBefore.launcher?.ariaLabel || ""}" |
| Panel | ${chatBefore.panel?.panelFound ? chatBefore.panel.panelId || chatBefore.panel.panelTag : "not found in DOM"} |
| Iframes | ${chatBefore.panel?.iframes?.length || 0} |
| localStorage keys | ${chatBefore.panel?.localStorageKeys?.join(", ") || "—"} |

${chatBefore.iframeContent?.sampleText ? `### Iframe body text\n\n\`\`\`\n${chatBefore.iframeContent.sampleText.slice(0, 500)}\n\`\`\`` : ""}

## 3. Network (newsletter/chat related)

${networkLog.map((n) => `- \`${n.method}\` ${n.url}`).join("\n") || "—"}
`;

  writeFileSync(OUT_MD, md);
  console.log("Wrote", OUT_MD);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
