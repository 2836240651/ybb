"use client";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://carp-ybb.com";

export type QuorlyxBootstrap = {
  enabled: boolean;
  reason?: string;
  styleUrl?: string;
  scriptUrl?: string;
  inlineCss?: string;
  vars?: Record<string, unknown>;
};

/** Plugin default FAB bottom is 20px; raise +100px for visibility. */
export const QUORLYX_FAB_BOTTOM_PX = 120;
/** Desktop chat panel default 95px; keep ~75px gap above FAB. */
export const QUORLYX_CHAT_PANEL_BOTTOM_PX = 195;

const FAB_SELECTORS = [
  ".quorlyx-floating-button-container",
  "#quorlyx-root .quorlyx-floating-button-container",
  "#quorlyx-root .quorlyx-floating-button",
  "#quorlyx-root .quorlyx-launcher",
  ".quorlyx-fab-wrap",
  "#quorlyx-root .quorlyx-fab-wrap.quorlyx-fab-wrap",
].join(",\n");

/** Beat Quorlyx inline @media rules (also bottom: 20px !important). */
export const QUORLYX_POSITION_OVERRIDE_CSS = `
@media (min-width: 769px) {
  ${FAB_SELECTORS} {
    bottom: ${QUORLYX_FAB_BOTTOM_PX}px !important;
  }
  .quorlyx-chat-panel:not(.quorlyx-exit-intent-modal) {
    bottom: ${QUORLYX_CHAT_PANEL_BOTTOM_PX}px !important;
  }
}

@media (max-width: 768px) {
  ${FAB_SELECTORS} {
    bottom: ${QUORLYX_FAB_BOTTOM_PX}px !important;
  }
}
`.trim();

export function quorlyxBootstrapUrl(): string {
  const base = `${SITE.replace(/\/$/, "")}/index.php`;
  return `${base}?${new URLSearchParams({
    rest_route: "/ybb/v1/quorlyx-bootstrap",
    _: String(Date.now()),
  }).toString()}`;
}

export async function fetchQuorlyxBootstrap(): Promise<QuorlyxBootstrap> {
  const res = await fetch(quorlyxBootstrapUrl(), {
    credentials: "same-origin",
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Quorlyx bootstrap HTTP ${res.status}`);
  }

  return (await res.json()) as QuorlyxBootstrap;
}

/** Inline style fallback when Quorlyx re-applies its own bottom offset. */
export function applyQuorlyxPositionDomOverride(): void {
  if (typeof document === "undefined") return;

  for (const selector of FAB_SELECTORS.split(",")) {
    document.querySelectorAll(selector.trim()).forEach((node) => {
      if (node instanceof HTMLElement) {
        node.style.setProperty("bottom", `${QUORLYX_FAB_BOTTOM_PX}px`, "important");
      }
    });
  }

  document
    .querySelectorAll(".quorlyx-chat-panel:not(.quorlyx-exit-intent-modal)")
    .forEach((node) => {
      if (node instanceof HTMLElement && window.matchMedia("(min-width: 769px)").matches) {
        node.style.setProperty("bottom", `${QUORLYX_CHAT_PANEL_BOTTOM_PX}px`, "important");
      }
    });
}
