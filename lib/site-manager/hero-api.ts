"use client";

import { useEffect, useState } from "react";
import { fetchYbbJson } from "@/lib/ybb-rest";
import type { TriLabels } from "@/lib/site-manager/labels";

export type HeroSlide = {
  id: string;
  href: string;
  imageUrl: string;
  labels?: TriLabels;
};

export type HeroResponse = {
  enabled: boolean;
  autoplayMs: number;
  slides: HeroSlide[];
  syncedAt?: string;
};

export async function fetchHero(): Promise<HeroResponse | null> {
  return fetchYbbJson<HeroResponse>("/ybb/v1/site-manager/hero");
}

export function useYbbHero(fallbackSlides: HeroSlide[], fallbackAutoplayMs = 7000) {
  const [slides, setSlides] = useState(fallbackSlides);
  const [autoplayMs, setAutoplayMs] = useState(fallbackAutoplayMs);
  const [enabled, setEnabled] = useState(true);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetchHero().then((data) => {
      if (cancelled) return;
      if (data) {
        setEnabled(data.enabled);
        setAutoplayMs(data.autoplayMs || fallbackAutoplayMs);
        if (data.slides?.length) setSlides(data.slides);
      }
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [fallbackSlides, fallbackAutoplayMs]);

  return { slides, autoplayMs, enabled, ready };
}
