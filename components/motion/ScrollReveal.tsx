"use client";

import {
  createElement,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ElementType,
  type ReactNode,
} from "react";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import {
  scrollRevealDelayMs,
  SCROLL_REVEAL_IO_THRESHOLD,
  SCROLL_REVEAL_ROOT_MARGIN,
  type ScrollRevealAnimate,
} from "@/lib/motion/scroll-reveal";
import { cn } from "@/lib/utils";

type ScrollRevealProps = {
  animate?: ScrollRevealAnimate;
  delay?: number;
  staggerIndex?: number;
  className?: string;
  children?: ReactNode;
  as?: ElementType;
};

export function ScrollReveal({
  animate = "fade-up",
  delay = 0,
  staggerIndex = 0,
  className,
  children,
  as: Tag = "div",
}: ScrollRevealProps) {
  const ref = useRef<HTMLElement | null>(null);
  const reducedMotion = usePrefersReducedMotion();
  const [visible, setVisible] = useState(reducedMotion);

  useEffect(() => {
    if (reducedMotion) {
      setVisible(true);
      return;
    }

    const el = ref.current;
    if (!el) return;

    el.setAttribute("data-scroll-reveal-ready", "");

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        setVisible(true);
        observer.disconnect();
      },
      {
        threshold: SCROLL_REVEAL_IO_THRESHOLD,
        rootMargin: SCROLL_REVEAL_ROOT_MARGIN,
      }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [reducedMotion]);

  const delayMs = scrollRevealDelayMs(delay, staggerIndex);

  return createElement(
    Tag,
    {
      ref,
      "data-scroll-reveal": animate,
      "data-scroll-reveal-ready": visible ? "" : undefined,
      className: cn("scroll-reveal", visible && "scroll-reveal--visible", className),
      style: {
        "--scroll-reveal-delay": `${delayMs}ms`,
      } as CSSProperties,
    },
    children
  );
}
