"use client";

import { EmblaProductCarousel } from "@/components/carousel/EmblaProductCarousel";
import type { Product } from "@/lib/types/product";

type HorizontalProductCarouselProps = {
  products: Product[];
  ariaLabel?: string;
};

export function HorizontalProductCarousel({
  products,
  ariaLabel = "Product carousel",
}: HorizontalProductCarouselProps) {
  return (
    <EmblaProductCarousel
      products={products}
      ariaLabel={ariaLabel}
      arrowsClassName="absolute -top-[4.5rem] right-0 hidden sm:flex"
    />
  );
}
