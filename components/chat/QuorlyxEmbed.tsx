"use client";

import { useEffect } from "react";
import {
  applyQuorlyxPositionDomOverride,
  fetchQuorlyxBootstrap,
  QUORLYX_POSITION_OVERRIDE_CSS,
} from "@/lib/quorlyx-embed";

declare global {
  interface Window {
    quorlyxVars?: Record<string, unknown>;
  }
}

const STYLE_ID = "ybb-quorlyx-style";
const INLINE_ID = "ybb-quorlyx-inline";
const OFFSET_ID = "ybb-quorlyx-offset";
const SCRIPT_ID = "quorlyx-frontend-js";

function ensureRoot(): HTMLElement {
  let root = document.getElementById("quorlyx-root");
  if (!root) {
    root = document.createElement("div");
    root.id = "quorlyx-root";
    document.body.appendChild(root);
  }
  return root;
}

function injectStylesheet(href: string) {
  if (document.getElementById(STYLE_ID)) return;
  const link = document.createElement("link");
  link.id = STYLE_ID;
  link.rel = "stylesheet";
  link.href = href;
  document.head.appendChild(link);
}

function injectInlineCss(css: string) {
  if (!css.trim()) return;
  let style = document.getElementById(INLINE_ID) as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement("style");
    style.id = INLINE_ID;
    document.head.appendChild(style);
  }
  style.textContent = css;
}

function injectPositionOverride() {
  let style = document.getElementById(OFFSET_ID) as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement("style");
    style.id = OFFSET_ID;
    document.head.appendChild(style);
  }
  style.textContent = QUORLYX_POSITION_OVERRIDE_CSS;
  applyQuorlyxPositionDomOverride();
}

function watchQuorlyxPosition(root: HTMLElement): () => void {
  injectPositionOverride();

  const observer = new MutationObserver(() => {
    injectPositionOverride();
  });

  observer.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ["style", "class"] });

  const timers = [0, 300, 1000, 2500].map((ms) =>
    window.setTimeout(() => injectPositionOverride(), ms)
  );

  return () => {
    observer.disconnect();
    timers.forEach((id) => window.clearTimeout(id));
  };
}

function loadScript(src: string): Promise<void> {
  const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
  if (existing) {
    if (existing.src === src) {
      return Promise.resolve();
    }
    existing.remove();
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.body.appendChild(script);
  });
}

export function QuorlyxEmbed() {
  useEffect(() => {
    let cancelled = false;
    let stopWatching: (() => void) | undefined;

    (async () => {
      try {
        const bootstrap = await fetchQuorlyxBootstrap();
        if (cancelled || !bootstrap.enabled || !bootstrap.vars) {
          return;
        }

        if (bootstrap.styleUrl) {
          injectStylesheet(bootstrap.styleUrl);
        }
        if (bootstrap.inlineCss) {
          injectInlineCss(bootstrap.inlineCss);
        }
        injectPositionOverride();

        const root = ensureRoot();
        const vars = { ...bootstrap.vars } as Record<string, unknown>;
        // YBB proxy routes use chatToken + same-origin; wp_rest nonce breaks on static pages.
        delete vars.nonce;
        window.quorlyxVars = vars;

        if (bootstrap.scriptUrl) {
          await loadScript(bootstrap.scriptUrl);
        }

        if (!cancelled) {
          stopWatching = watchQuorlyxPosition(root);
        }
      } catch (err) {
        if (!cancelled) {
          console.warn("[QuorlyxEmbed] bootstrap failed:", err);
        }
      }
    })();

    return () => {
      cancelled = true;
      stopWatching?.();
    };
  }, []);

  return null;
}
