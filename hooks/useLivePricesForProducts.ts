"use client";

import { useEffect, useMemo, useState } from "react";
import { scheduleIdleWork } from "@/lib/browser/schedule-idle";
import { enrichProductForList } from "@/lib/woocommerce/product-live-merge";
import {
  fetchLiveProductSummaries,
  type LiveProductSummary,
} from "@/lib/woocommerce/product-live-api";
import type { Product } from "@/lib/types/product";

/** Fetch Woo live price/stock for a small product slice (e.g. one grid page). */
export function useLivePricesForProducts(products: Product[]) {
  const [summaries, setSummaries] = useState<Map<number, LiveProductSummary>>(
    new Map()
  );
  const [liveReady, setLiveReady] = useState(true);

  const wcIds = useMemo(
    () =>
      products
        .map((product) => product.wcId)
        .filter((id): id is number => typeof id === "number" && id > 0),
    [products]
  );
  const wcIdsKey = wcIds.join(",");

  useEffect(() => {
    let cancelled = false;
    if (!wcIds.length) {
      setSummaries(new Map());
      setLiveReady(true);
      return;
    }

    setLiveReady(false);
    const cancelIdle = scheduleIdleWork(() => {
      void fetchLiveProductSummaries(wcIds).then((map) => {
        if (cancelled) return;
        setSummaries(map);
        setLiveReady(true);
      });
    });

    return () => {
      cancelled = true;
      cancelIdle();
    };
  }, [wcIdsKey, wcIds]);

  const enrichedProducts = useMemo(
    () =>
      products.map((product) =>
        enrichProductForList(
          product,
          undefined,
          product.wcId ? summaries.get(product.wcId) : undefined
        )
      ),
    [products, summaries]
  );

  return { products: enrichedProducts, ready: true, liveReady };
}
