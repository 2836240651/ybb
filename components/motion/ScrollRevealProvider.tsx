"use client";

import { useEffect } from "react";
import {
  SCROLL_REVEAL_IO_THRESHOLD,
  SCROLL_REVEAL_ROOT_MARGIN,
} from "@/lib/motion/scroll-reveal";

const VISIBLE_CLASS = "scroll-reveal--visible";
const SELECTOR = "[data-scroll-reveal]:not([data-scroll-reveal-ready])";

function revealImmediately(el: Element) {
  el.setAttribute("data-scroll-reveal-ready", "");
  el.classList.add(VISIBLE_CLASS);
}

function observeElement(el: Element, observer: IntersectionObserver) {
  if (el.hasAttribute("data-scroll-reveal-ready")) return;
  el.setAttribute("data-scroll-reveal-ready", "");
  observer.observe(el);
}

/**
 * Global scroll-reveal driver for any element with `data-scroll-reveal`.
 * Matches OMC animate-element + IntersectionObserver pattern.
 */
export function ScrollRevealProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add(VISIBLE_CLASS);
          observer.unobserve(entry.target);
        }
      },
      {
        threshold: SCROLL_REVEAL_IO_THRESHOLD,
        rootMargin: SCROLL_REVEAL_ROOT_MARGIN,
      }
    );

    const scan = (root: ParentNode = document) => {
      root.querySelectorAll(SELECTOR).forEach((el) => {
        if (reduced) {
          revealImmediately(el);
          return;
        }
        observeElement(el, observer);
      });
    };

    scan();

    const mutation = new MutationObserver((records) => {
      for (const record of records) {
        if (record.type === "attributes" && record.target instanceof Element) {
          if (record.target.matches("[data-scroll-reveal]")) {
            scan(record.target.parentNode ?? document);
          }
          continue;
        }
        record.addedNodes.forEach((node) => {
          if (node instanceof Element) {
            if (node.matches("[data-scroll-reveal]")) scan(node.parentNode ?? document);
            scan(node);
          }
        });
      }
    });

    mutation.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["data-scroll-reveal", "data-scroll-reveal-index"],
    });

    return () => {
      observer.disconnect();
      mutation.disconnect();
    };
  }, []);

  return children;
}
