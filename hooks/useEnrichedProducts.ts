"use client";

import { useEffect, useMemo, useState } from "react";
import { scheduleIdleWork } from "@/lib/browser/schedule-idle";
import { useProductOverrides } from "@/hooks/useProductOverrides";
import {
  enrichProductForList,
  filterProductsForCatalog,
} from "@/lib/woocommerce/product-live-merge";
import {
  fetchLiveProductSummaries,
  type LiveProductSummary,
} from "@/lib/woocommerce/product-live-api";
import type { Product } from "@/lib/types/product";

/** Hot products / small lists: visibility + live prices for all items. */
export function useEnrichedProducts(products: Product[]) {
  const { overrides, ready: overridesReady } = useProductOverrides();
  const [summaries, setSummaries] = useState<Map<number, LiveProductSummary>>(
    new Map()
  );
  const [liveReady, setLiveReady] = useState(false);

  const visibleProducts = useMemo(
    () => filterProductsForCatalog(products, overrides, overridesReady),
    [products, overrides, overridesReady]
  );

  const wcIds = useMemo(
    () =>
      visibleProducts
        .map((product) => product.wcId)
        .filter((id): id is number => typeof id === "number" && id > 0),
    [visibleProducts]
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
      visibleProducts.map((product) =>
        enrichProductForList(
          product,
          overrides[product.handle],
          product.wcId ? summaries.get(product.wcId) : undefined
        )
      ),
    [visibleProducts, overrides, summaries]
  );

  return {
    products: enrichedProducts,
    overridesReady,
    liveReady,
    ready: overridesReady,
  };
}
