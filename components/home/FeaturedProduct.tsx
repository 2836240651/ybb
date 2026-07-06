"use client";

import { useMemo, useState } from "react";
import { ProductMediaGallery } from "@/components/product/ProductMediaGallery";
import { ProductPurchasePanel } from "@/components/product/ProductPurchasePanel";
import { ScrollReveal } from "@/components/motion/ScrollReveal";
import {
  getProductByHandle,
  getProductGalleryImages,
  getProductVariants,
  getVariant,
} from "@/lib/data/products";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { getDisplaySku, getLocalizedVariantSpec } from "@/lib/i18n/variant-spec";
import { useYbbFeaturedProduct } from "@/lib/site-manager/home-modules-api";

const DEFAULT_FEATURED_HANDLE = "three-way-swivel-kit-box";

export function FeaturedProduct() {
  const { locale } = useI18n();
  const { handle, enabled, ready } = useYbbFeaturedProduct(DEFAULT_FEATURED_HANDLE);
  const product = getProductByHandle(handle);
  const defaultVariant = product ? getVariant(product) : undefined;
  const variantChoices = product
    ? getProductVariants(product).map((v) => ({
        value: v.spec,
        label: getLocalizedVariantSpec(v, locale),
      }))
    : [];
  const [variant, setVariant] = useState<string>(defaultVariant?.spec || "Default");

  const selectedVariant = useMemo(
    () => (product ? getVariant(product, variant) : undefined),
    [product, variant]
  );

  const displayProduct = useMemo(() => {
    if (!product || !selectedVariant) return product;
    return {
      ...product,
      price: selectedVariant.price,
      compareAtPrice: selectedVariant.compareAtPrice,
      available: selectedVariant.available,
      sku: getDisplaySku(product.sku, selectedVariant, locale),
      spec: selectedVariant.spec,
    };
  }, [product, selectedVariant, locale]);

  if (ready && !enabled) return null;
  if (!product || !displayProduct) return null;

  const galleryImages = getProductGalleryImages(product, selectedVariant);

  return (
    <section
      className="page-container"
      aria-labelledby="featured-product-heading"
    >
      <div className="grid gap-8 lg:grid-cols-2 lg:gap-12 xl:gap-16 items-start">
        <ScrollReveal animate="zoom-out" className="min-w-0">
          <ProductMediaGallery
            images={galleryImages}
            alt={product.title}
            priority
          />
        </ScrollReveal>

        <ScrollReveal animate="fade-up-large" delay={80}>
          <ProductPurchasePanel
            product={displayProduct}
            variant={variant}
            onVariantChange={setVariant}
            variantOptions={
              variantChoices.length
                ? variantChoices
                : [{ value: defaultVariant?.spec || "Default", label: defaultVariant?.spec || "Default" }]
            }
            variantLabel="Pack"
            brandLabel="YBB Tackle"
            showQuantity={false}
            headingLevel="h2"
            headingId="featured-product-heading"
            detailsHref={`/products/${product.handle}`}
            description="Three-way swivel kit in a retail-ready box �?reliable terminal tackle for carp rigs, with crisp factory photography across every angle."
          />
        </ScrollReveal>
      </div>
    </section>
  );
}
