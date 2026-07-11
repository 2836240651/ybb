"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AddToCartButton } from "@/components/cart/AddToCartButton";
import { PairsWellWith } from "@/components/product/PairsWellWith";
import { RecordRecentlyViewed } from "@/components/product/RecordRecentlyViewed";
import { ProductMediaGallery } from "@/components/product/ProductMediaGallery";
import { ProductContentTabs } from "@/components/product/ProductContentTabs";
import { ProductPurchasePanel } from "@/components/product/ProductPurchasePanel";
import { ScrollReveal } from "@/components/motion/ScrollReveal";
import {
  formatPrice,
  getProductVariants,
  getVariant,
} from "@/lib/data/products";
import { resolveProductGallery } from "@/lib/woocommerce/product-gallery";
import { useProductLive } from "@/hooks/useProductLive";
import { useI18n, useProductTitle } from "@/lib/i18n/I18nProvider";
import { getDisplaySku, getLocalizedVariantSpec } from "@/lib/i18n/variant-spec";
import { resolvePurchaseSlogan } from "@/lib/site-manager/purchase-slogan";
import { resolveShopPayInstallmentText } from "@/lib/site-manager/shop-pay-installments";
import type { Product } from "@/lib/types/product";

type ProductDetailProps = {
  product: Product;
  collectionTitle?: string;
};

export function ProductDetail({ product: staticProduct, collectionTitle }: ProductDetailProps) {
  const { t, locale } = useI18n();
  const { product, live, ready, defaultVariantSpec } = useProductLive(staticProduct);
  const productTitle = useProductTitle(product);
  const variantChoices = useMemo(
    () =>
      getProductVariants(product).map((v) => ({
        value: v.spec,
        label: getLocalizedVariantSpec(v, locale),
      })),
    [product, locale]
  );
  const defaultVariant = getVariant(product, defaultVariantSpec);
  const [variant, setVariant] = useState<string>(
    defaultVariant?.spec || defaultVariantSpec
  );
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    if (!ready) return;
    const specs = variantChoices.length
      ? variantChoices.map((v) => v.value)
      : [defaultVariant?.spec || defaultVariantSpec];
    if (!specs.includes(variant)) {
      setVariant(specs[0] ?? defaultVariantSpec);
    }
  }, [ready, variant, variantChoices, defaultVariant, defaultVariantSpec]);

  const selectedVariant = useMemo(
    () => getVariant(product, variant),
    [product, variant]
  );
  const galleryImages = useMemo(
    () =>
      resolveProductGallery(
        staticProduct,
        live?.gallery,
        live?.images,
        selectedVariant,
        ready
      ),
    [staticProduct, live?.gallery, live?.images, selectedVariant, ready]
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
        ready
      ),
    [live?.purchaseSlogan, locale, t, ready]
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

  return (
    <>
      <RecordRecentlyViewed handle={product.handle} />
      <div className="page-container py-8 md:py-10 lg:py-16 pb-36 lg:pb-16">
        <nav className="mb-8 text-sm text-foreground/50" aria-label="Breadcrumb">
          <ol className="flex flex-wrap items-center gap-2">
            <li>
              <Link href="/" className="hover:opacity-70">
                {t("common.home")}
              </Link>
            </li>
            <li aria-hidden>/</li>
            <li>
              <Link
                href={`/collections/${product.collection}`}
                className="hover:opacity-70"
              >
                {collectionTitle ?? product.collection.replace(/-/g, " ")}
              </Link>
            </li>
            <li aria-hidden>/</li>
            <li className="text-foreground truncate max-w-[12rem] sm:max-w-none">
              {productTitle}
            </li>
          </ol>
        </nav>

        <div className="grid gap-10 lg:grid-cols-2 lg:gap-12 xl:gap-16 items-start">
          <ScrollReveal animate="zoom-out" className="min-w-0">
            <ProductMediaGallery
              images={galleryImages.images}
              alt={productTitle}
              priority
              defaultIndex={galleryImages.defaultIndex}
              enabled={galleryImages.enabled}
            />
          </ScrollReveal>

          <ScrollReveal animate="fade-up-large" delay={80} className="product__info lg:sticky lg:top-28 lg:self-start w-full">
            {live?.frontHidden && (
              <p className="mb-4 rounded-input border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                {t("product.unavailable") || "This product is temporarily hidden on the storefront."}
              </p>
            )}
            <ProductPurchasePanel
              product={displayProduct}
              variant={variant}
              onVariantChange={setVariant}
              variantOptions={
                variantChoices.length
                  ? variantChoices
                  : [{ value: defaultVariant?.spec || "Default", label: defaultVariant?.spec || "Default" }]
              }
              variantLabel={t("product.pack")}
              quantity={quantity}
              onQuantityChange={setQuantity}
              headingLevel="h1"
              purchaseSlogan={purchaseSlogan}
              shopPayInstallmentText={shopPayInstallmentText}
              pdpTabLabels={live?.pdpTabLabels}
            />
          </ScrollReveal>
        </div>

        <ProductContentTabs
          content={live?.content}
          pdpTabLabels={live?.pdpTabLabels}
          ready={ready}
          product={product}
        />

        <PairsWellWith product={product} />

        {product.tags.length > 0 && (
          <ul className="mt-12 flex flex-wrap gap-2 border-t border-border pt-8">
            {product.tags.map((tag) => (
              <li
                key={tag}
                className="rounded-pill bg-neutral-100 px-3 py-1 text-xs capitalize"
              >
                {tag.replace(/-/g, " ")}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div
        className="fixed inset-x-0 z-20 border-t border-border bg-white/95 backdrop-blur px-4 py-3 lg:hidden bottom-[calc(3rem+env(safe-area-inset-bottom,0px))]"
        aria-label="Add to cart"
      >
        <div className="flex items-center gap-3 max-w-lg mx-auto">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold truncate">
              {formatPrice(displayProduct.price)}
            </p>
            <p className="text-xs text-foreground/50 truncate">
              {displayProduct.sku ? `${displayProduct.sku} · ` : ""}
              {productTitle}
            </p>
          </div>
          <AddToCartButton
            product={displayProduct}
            variant={variant}
            quantity={quantity}
            label="Add to cart"
            className="shrink-0 h-[52px] px-6 text-sm"
          />
        </div>
      </div>
    </>
  );
}
