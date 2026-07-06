"use client";

import { useMemo } from "react";
import { useProductOverrides } from "@/hooks/useProductOverrides";
import {
  applyOverridesToProduct,
  filterProductsForCatalog,
} from "@/lib/woocommerce/product-live-merge";
import type { Product } from "@/lib/types/product";

/** Apply override titles + frontHidden filter without Store API batch fetch. */
export function useVisibleCatalogProducts(products: Product[]) {
  const { overrides, ready } = useProductOverrides();

  return useMemo(
    () =>
      filterProductsForCatalog(products, overrides, ready).map((product) =>
        applyOverridesToProduct(product, overrides[product.handle])
      ),
    [products, overrides, ready]
  );
}
