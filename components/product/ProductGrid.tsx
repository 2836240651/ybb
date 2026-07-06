"use client";

import { CollectionEmptyState } from "@/components/product/CollectionEmptyState";
import { ProductCard } from "@/components/product/ProductCard";
import { useLivePricesForProducts } from "@/hooks/useLivePricesForProducts";
import { HardNavLink } from "@/lib/navigation/hard-nav-fallback";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { Product } from "@/lib/types/product";
import { cn } from "@/lib/utils";
import { useCollectionQuery } from "./CollectionQueryProvider";

const PAGE_SIZE = 24;

type ProductGridProps = {
  products: Product[];
  collectionHandle: string;
  sourceProductCount: number;
  filtersActive: boolean;
};

function ProductGridFilled({ products }: { products: Product[] }) {
  const { t } = useI18n();
  const { page, goToPage } = useCollectionQuery();
  const totalPages = Math.max(1, Math.ceil(products.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * PAGE_SIZE;
  const pageProducts = products.slice(start, start + PAGE_SIZE);
  const { products: displayProducts } = useLivePricesForProducts(pageProducts);

  return (
    <div className="space-y-10">
      <div className="product-grid grid grid-cols-2 gap-x-[18px] gap-y-10">
        {displayProducts.map((product, i) => (
          <ProductCard
            key={product.handle}
            product={product}
            priority={safePage === 1 && i < 4}
            imageAspect="square"
          />
        ))}
      </div>

      {totalPages > 1 && (
        <nav
          className="flex flex-wrap items-center justify-center gap-2"
          aria-label="Product pagination"
        >
          <button
            type="button"
            onClick={() => goToPage(safePage - 1)}
            disabled={safePage <= 1}
            aria-label="Previous page"
            className="rounded-pill border border-border px-4 py-2 text-sm hover:bg-neutral-50 disabled:opacity-40 disabled:pointer-events-none transition-colors"
          >
            {t("common.previous")}
          </button>

          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <HardNavLink
              key={p}
              href={p <= 1 ? "?" : `?page=${p}`}
              scroll
              className={cn(
                "inline-flex h-9 min-w-9 items-center justify-center rounded-pill border px-3 text-sm transition-colors",
                p === safePage
                  ? "border-foreground bg-foreground text-background"
                  : "border-border hover:bg-neutral-50"
              )}
              aria-current={p === safePage ? "page" : undefined}
            >
              {p}
            </HardNavLink>
          ))}

          <button
            type="button"
            onClick={() => goToPage(safePage + 1)}
            disabled={safePage >= totalPages}
            aria-label="Next page"
            className="rounded-pill border border-border px-4 py-2 text-sm hover:bg-neutral-50 disabled:opacity-40 disabled:pointer-events-none transition-colors"
          >
            {t("common.next")}
          </button>
        </nav>
      )}

      <p className="text-center text-xs text-foreground/50">
        {t("collection.showingRange", {
          from: start + 1,
          to: Math.min(start + PAGE_SIZE, products.length),
          total: products.length,
        })}
      </p>
    </div>
  );
}

export function ProductGrid({
  products,
  collectionHandle,
  sourceProductCount,
  filtersActive,
}: ProductGridProps) {
  if (products.length === 0) {
    const reason =
      filtersActive && sourceProductCount > 0
        ? "filtered"
        : sourceProductCount > 0
          ? "hidden"
          : "empty";

    return (
      <CollectionEmptyState currentHandle={collectionHandle} reason={reason} />
    );
  }

  return <ProductGridFilled products={products} />;
}
