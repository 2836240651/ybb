"use client";

import { useEffect, useState } from "react";
import { fetchYbbJson } from "@/lib/ybb-rest";
import type { TriLabels } from "@/lib/site-manager/labels";

export type FactoryVideoResponse = {
  enabled: boolean;
  videoUrl: string;
  posterUrl: string;
  labels: {
    title?: TriLabels;
    body?: TriLabels;
    cta?: TriLabels;
  };
  syncedAt?: string;
};

export function useYbbFactoryVideo() {
  const [data, setData] = useState<FactoryVideoResponse | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetchYbbJson<FactoryVideoResponse>("/ybb/v1/site-manager/factory-video").then(
      (res) => {
        if (cancelled) return;
        setData(res);
        setReady(true);
      }
    );
    return () => {
      cancelled = true;
    };
  }, []);

  return { data, ready };
}

export type FeaturedProductResponse = {
  enabled: boolean;
  handle: string;
  product?: {
    handle: string;
    title: string;
    price: number;
    compareAtPrice?: number | null;
    image: string;
    href: string;
    available: boolean;
  };
  syncedAt?: string;
};

export function useYbbFeaturedProduct(fallbackHandle: string) {
  const [handle, setHandle] = useState(fallbackHandle);
  const [enabled, setEnabled] = useState(true);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetchYbbJson<FeaturedProductResponse>(
      "/ybb/v1/site-manager/featured-product"
    ).then((res) => {
      if (cancelled) return;
      if (res) {
        setEnabled(res.enabled);
        if (res.handle) setHandle(res.handle);
      }
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [fallbackHandle]);

  return { handle, enabled, ready };
}

export type SiteBrandResponse = {
  name: string;
  tagline: TriLabels;
  logoAlt: string;
  logoPath: string;
  syncedAt?: string;
};

export function useYbbSiteBrand() {
  const [brand, setBrand] = useState<SiteBrandResponse | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetchYbbJson<SiteBrandResponse>("/ybb/v1/site-brand").then((res) => {
      if (cancelled) return;
      setBrand(res);
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return { brand, ready };
}
