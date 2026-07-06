"use client";

import Image from "next/image";

type ProductMediaMasonryProps = {
  images: string[];
  alt: string;
  priority?: boolean;
};

/** OMC Featured Product: 2-col masonry �?tall main + stacked secondary */
export function ProductMediaMasonry({
  images,
  alt,
  priority = false,
}: ProductMediaMasonryProps) {
  const safe = images.length > 0 ? images : ["/images/placeholder-product.webp"];
  const [main, ...rest] = safe;
  const secondary = rest.slice(0, 2);

  if (secondary.length === 0) {
    return (
      <div className="product__media-main relative aspect-square overflow-hidden rounded-card" aria-label="Product gallery">
        <Image
          src={main!}
          alt={alt}
          fill
          sizes="(max-width: 768px) 100vw, 50vw"
          className="rounded-card object-contain p-4 md:p-6 mix-blend-multiply"
          priority={priority}
        />
      </div>
    );
  }

  return (
    <div
      className="featured-product-masonry flex gap-3 sm:gap-4 md:gap-5"
      aria-label="Product gallery"
    >
      <div className="product__media-main relative min-w-0 flex-1 overflow-hidden rounded-card featured-product-masonry__main">
        <Image
          src={main!}
          alt={alt}
          fill
          sizes="(max-width: 768px) 50vw, 25vw"
          className="rounded-card object-contain p-4 md:p-6 mix-blend-multiply"
          priority={priority}
        />
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-3 sm:gap-4 md:gap-5">
        {secondary.map((src, i) => (
          <div
            key={`${src}-${i}`}
            className="product__media-main relative aspect-square overflow-hidden rounded-card"
          >
            <Image
              src={src}
              alt=""
              fill
              sizes="(max-width: 768px) 45vw, 22vw"
              className="rounded-card object-contain p-3 md:p-4 mix-blend-multiply"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
