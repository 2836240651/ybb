"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type Phase = "idle" | "cover" | "reveal";

export function PageTransitionOverlay() {
  const pathname = usePathname();
  const [phase, setPhase] = useState<Phase>("cover");
  const isFirst = useRef(true);
  const reduceMotion = useRef(false);

  useEffect(() => {
    reduceMotion.current = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
  }, []);

  useEffect(() => {
    if (isFirst.current) {
      isFirst.current = false;
      setPhase("reveal");
      const timer = window.setTimeout(
        () => setPhase("idle"),
        reduceMotion.current ? 0 : 1000
      );
      return () => window.clearTimeout(timer);
    }

    setPhase("cover");
    let revealTimer: number | undefined;
    const coverTimer = window.setTimeout(() => {
      setPhase("reveal");
      revealTimer = window.setTimeout(
        () => setPhase("idle"),
        reduceMotion.current ? 0 : 1000
      );
    }, reduceMotion.current ? 0 : 80);

    return () => {
      window.clearTimeout(coverTimer);
      if (revealTimer) window.clearTimeout(revealTimer);
    };
  }, [pathname]);

  if (phase === "idle") return null;

  return (
    <div
      className={cn(
        "page-transition-overlay",
        phase === "cover" && "page-transition-overlay--cover",
        phase === "reveal" && "page-transition-overlay--reveal"
      )}
      aria-hidden
    />
  );
}
