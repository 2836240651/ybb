"use client";

import { useEffect, useRef, useState } from "react";

/** Scroll distance before nav bar pins to viewport top (announcement + offset). */
export const HEADER_STICKY_SCROLL = 200;
/** Reveal nav when scrolled back near top. */
export const SCROLL_TOP_THRESHOLD = 50;
/** Minimum scroll delta (px) before toggling direction. */
const DELTA_MIN = 8;
/**
 * Hide after scrolling past mid-screen (50vh).
 * Phase 1: header sticky (CSS). Phase 2: fade/slide out past this threshold on scroll-down.
 */
export const MID_VIEWPORT_RATIO = 0.5;

function getScrollY() {
  return window.scrollY || document.documentElement.scrollTop || 0;
}

function getMidViewportThreshold() {
  return window.innerHeight * MID_VIEWPORT_RATIO;
}

/**
 * Sticky header (CSS) + mid-screen fade-out on scroll down, fade-in on scroll up.
 */
export function useHeaderScroll() {
  const [hidden, setHidden] = useState(false);
  const lastY = useRef(0);
  const ticking = useRef(false);
  const hiddenRef = useRef(false);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;

    const y0 = getScrollY();
    lastY.current = y0;
    if (y0 >= getMidViewportThreshold()) {
      hiddenRef.current = true;
      setHidden(true);
    }

    const update = () => {
      const y = getScrollY();
      const delta = y - lastY.current;
      const mid = getMidViewportThreshold();

      let nextHidden = hiddenRef.current;

      if (y <= SCROLL_TOP_THRESHOLD) {
        nextHidden = false;
      } else if (delta < -DELTA_MIN) {
        nextHidden = false;
      } else if (delta > DELTA_MIN && y >= mid) {
        nextHidden = true;
      }

      if (nextHidden !== hiddenRef.current) {
        hiddenRef.current = nextHidden;
        setHidden(nextHidden);
      }

      lastY.current = y;
      ticking.current = false;
    };

    const onScroll = () => {
      if (!ticking.current) {
        ticking.current = true;
        requestAnimationFrame(update);
      }
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return hidden;
}
