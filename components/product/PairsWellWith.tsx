import { ProductCard } from "@/components/product/ProductCard";
import { getProductsByCollection } from "@/lib/data/products";
import type { Product } from "@/lib/types/product";

type PairsWellWithProps = {
  product: Product;
  limit?: number;
};

export function PairsWellWith({ product, limit = 4 }: PairsWellWithProps) {
  const related = getProductsByCollection(product.collection)
    .filter((p) => p.handle !== product.handle)
    .slice(0, limit);

  if (related.length === 0) return null;

  return (
    <section className="mt-20 border-t border-border pt-14" aria-labelledby="pairs-heading">
      <h2 id="pairs-heading" className="text-title-md mb-10">
        Pairs well with
      </h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-x-[18px] gap-y-12">
        {related.map((p) => (
          <ProductCard key={p.handle} product={p} imageAspect="square" />
        ))}
      </div>
    </section>
  );
}
