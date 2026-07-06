"use client";

import { useEffect, useState } from "react";
import {
  fetchProductOverrides,
  type ProductOverridesResponse,
} from "@/lib/site-manager/product-overrides-api";

let cached: ProductOverridesResponse | null = null;
let inflight: Promise<ProductOverridesResponse | null> | null = null;

async function loadOverrides(): Promise<ProductOverridesResponse | null> {
  if (cached) return cached;
  if (!inflight) {
    inflight = fetchProductOverrides().then((data) => {
      if (data) cached = data;
      inflight = null;
      return data;
    });
  }
  return inflight;
}

export function useProductOverrides() {
  const [data, setData] = useState<ProductOverridesResponse | null>(cached);
  const [ready, setReady] = useState(Boolean(cached));

  useEffect(() => {
    let cancelled = false;
    void loadOverrides().then((remote) => {
      if (cancelled) return;
      if (remote) setData(remote);
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return {
    overrides: data?.overrides ?? {},
    enabled: data?.enabled !== false,
    ready,
  };
}
