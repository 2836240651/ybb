/** OMC Concept animate-element types ?audit-omc-scroll-reveal.mjs */
export type ScrollRevealAnimate = "zoom-out" | "fade-up-large" | "fade-up";

export const SCROLL_REVEAL_STAGGER_MS = 80;
export const SCROLL_REVEAL_IO_THRESHOLD = 0.12;
export const SCROLL_REVEAL_ROOT_MARGIN = "0px 0px -8% 0px";

export function scrollRevealDelayMs(
  delay = 0,
  staggerIndex = 0,
  staggerStep = SCROLL_REVEAL_STAGGER_MS
) {
  return delay + staggerIndex * staggerStep;
}
