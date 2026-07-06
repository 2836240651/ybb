"use client";

import { Suspense, useMemo } from "react";
import type { Collection, Product } from "@/lib/types/product";
import {
  filterAndSortProducts,
  countActiveFilters,
} from "@/lib/collection-filters";
import { useVisibleCatalogProducts } from "@/hooks/useVisibleCatalogProducts";
import { CollectionPageHeader } from "./CollectionPageHeader";
import { CollectionToolbar } from "./CollectionToolbar";
import { FilterDrawer } from "./FilterDrawer";
import { ProductGrid } from "./ProductGrid";
import {
  CollectionQueryProvider,
  useCollectionQuery,
} from "./CollectionQueryProvider";
import { useI18n } from "@/lib/i18n/I18nProvider";

function CollectionCatalog({
  collection,
  products,
}: {
  collection: Collection;
  products: Product[];
}) {
  const { filters } = useCollectionQuery();

  const filteredProducts = useMemo(
    () => filterAndSortProducts(products, filters),
    [products, filters]
  );
  const catalogProducts = useVisibleCatalogProducts(filteredProducts);
  const filtersActive = countActiveFilters(filters) > 0;

  return (
    <div className="page-container py-8 md:py-10 lg:py-16 pt-4 md:pt-6">
      <CollectionPageHeader
        collection={collection}
        productCount={catalogProducts.length}
      />

      {(catalogProducts.length > 0 || filtersActive) && (
        <>
          <CollectionToolbar productCount={catalogProducts.length} />
          <FilterDrawer />
        </>
      )}

      <ProductGrid
        products={catalogProducts}
        collectionHandle={collection.handle}
        sourceProductCount={filteredProducts.length}
        filtersActive={filtersActive}
      />
    </div>
  );
}

function CollectionPageEmpty({ collection }: { collection: Collection }) {
  return (
    <div className="page-container py-8 md:py-10 lg:py-16 pt-4 md:pt-6">
      <CollectionPageHeader collection={collection} productCount={0} />
      <ProductGrid
        products={[]}
        collectionHandle={collection.handle}
        sourceProductCount={0}
        filtersActive={false}
      />
    </div>
  );
}

export function CollectionPageClient({
  collection,
  products,
}: {
  collection: Collection;
  products: Product[];
}) {
  const { t } = useI18n();

  if (products.length === 0) {
    return <CollectionPageEmpty collection={collection} />;
  }

  return (
    <Suspense
      fallback={
        <div className="page-container py-16 text-center text-foreground/60">
          {t("common.loadingCatalog")}
        </div>
      }
    >
      <CollectionQueryProvider>
        <CollectionCatalog collection={collection} products={products} />
      </CollectionQueryProvider>
    </Suspense>
  );
}
