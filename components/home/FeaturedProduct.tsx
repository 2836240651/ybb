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
import { useProductLive } from "@/hooks/useProductLive";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { getDisplaySku, getLocalizedVariantSpec } from "@/lib/i18n/variant-spec";
import { resolvePurchaseSlogan } from "@/lib/site-manager/purchase-slogan";
import { resolveShopPayInstallmentText } from "@/lib/site-manager/shop-pay-installments";
import { useYbbFeaturedProduct } from "@/lib/site-manager/home-modules-api";
import type { Product } from "@/lib/types/product";

function FeaturedProductBody({ staticProduct }: { staticProduct: Product }) {
  const { locale, t } = useI18n();
  const { product, live, ready: liveReady } = useProductLive(staticProduct);
  const defaultVariant = getVariant(product);
  const variantChoices = getProductVariants(product).map((v) => ({
    value: v.spec,
    label: getLocalizedVariantSpec(v, locale),
  }));
  const [variant, setVariant] = useState<string>(defaultVariant?.spec || "Default");

  const selectedVariant = useMemo(
    () => getVariant(product, variant),
    [product, variant]
  );

  const displayProduct = useMemo(() => {
    if (!selectedVariant) return product;
    return {
      ...product,
      price: selectedVariant.price,
      compareAtPrice: selectedVariant.compareAtPrice,
      available: selectedVariant.available,
      sku: getDisplaySku(product.sku, selectedVariant, locale),
      spec: selectedVariant.spec,
    };
  }, [product, selectedVariant, locale]);

  const purchaseSlogan = useMemo(
    () =>
      resolvePurchaseSlogan(
        live?.purchaseSlogan,
        locale,
        t("product.defaultDescription"),
        liveReady
      ),
    [live?.purchaseSlogan, locale, t, liveReady]
  );

  const shopPayInstallmentText = useMemo(
    () =>
      resolveShopPayInstallmentText(
        live?.shopPayInstallments,
        locale,
        displayProduct.price,
        t("product.shopPayInstallmentTemplate")
      )?.text ?? null,
    [live?.shopPayInstallments, locale, displayProduct.price, t]
  );

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
            detailsHref={`/products/${product.handle}.html`}
            purchaseSlogan={purchaseSlogan}
            shopPayInstallmentText={shopPayInstallmentText}
            wholesaleLink={false}
          />
        </ScrollReveal>
      </div>
    </section>
  );
}

const DEFAULT_FEATURED_HANDLE = "three-way-swivel-kit-box";

export function FeaturedProduct() {
  const { handle, enabled, ready: featuredReady } = useYbbFeaturedProduct(DEFAULT_FEATURED_HANDLE);
  const staticProduct = getProductByHandle(handle);

  if (featuredReady && !enabled) return null;
  if (!staticProduct) return null;

  return <FeaturedProductBody staticProduct={staticProduct} />;
}
