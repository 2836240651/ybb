"use client";

import { useEffect, useMemo, useState } from "react";
import { ProductMediaGallery } from "@/components/product/ProductMediaGallery";
import { ProductPurchasePanel } from "@/components/product/ProductPurchasePanel";
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
import { useUI } from "@/lib/store/ui";
import { cn } from "@/lib/utils";

function QuickViewBody({ handle }: { handle: string }) {
  const { locale, t } = useI18n();
  const { closeQuickView } = useUI();
  const staticProduct = getProductByHandle(handle);
  const { product, live, ready } = useProductLive(staticProduct!);
  const defaultVariant = getVariant(product);
  const variantChoices = getProductVariants(product).map((v) => ({
    value: v.spec,
    label: getLocalizedVariantSpec(v, locale),
  }));
  const [variant, setVariant] = useState<string>(defaultVariant?.spec || "Default");

  useEffect(() => {
    if (defaultVariant) setVariant(defaultVariant.spec);
  }, [defaultVariant]);

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

  const images = getProductGalleryImages(product, selectedVariant);

  return (
    <>
      <header className="flex shrink-0 items-center justify-between border-b border-border bg-white px-4 py-3 md:px-6">
        <h2 className="text-sm font-medium truncate pr-4">Quick view</h2>
        <button
          type="button"
          onClick={closeQuickView}
          className="flex h-10 w-10 items-center justify-center rounded-full interaction-icon-hover"
          aria-label="Close quick view"
        >
          <span aria-hidden>{"×"}</span>
        </button>
      </header>
      <div className="grid min-h-0 flex-1 gap-6 overflow-y-auto p-4 md:grid-cols-2 md:gap-8 md:p-6">
        <ProductMediaGallery images={images} alt={product.title} />
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
          showQuantity={false}
          headingLevel="h2"
          detailsHref={`/products/${product.handle}.html`}
          wholesaleLink={false}
          purchaseSlogan={purchaseSlogan}
          shopPayInstallmentText={shopPayInstallmentText}
        />
      </div>
    </>
  );
}

export function ProductQuickViewModal() {
  const { quickViewHandle, closeQuickView } = useUI();

  useEffect(() => {
    document.body.style.overflow = quickViewHandle ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [quickViewHandle]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeQuickView();
    };
    if (quickViewHandle) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [quickViewHandle, closeQuickView]);

  if (!quickViewHandle || !getProductByHandle(quickViewHandle)) return null;

  return (
    <div
      className="fixed inset-0 z-[55] flex items-center justify-center p-4"
      role="presentation"
    >
      <div
        className="absolute inset-0 bg-[rgb(23_23_23/0.7)] transition-opacity"
        aria-hidden
        onClick={closeQuickView}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Quick view"
        className={cn(
          "relative z-[1] flex w-full max-h-[90vh] max-w-4xl flex-col overflow-hidden",
          "rounded-card bg-white shadow-2xl"
        )}
      >
        <QuickViewBody handle={quickViewHandle} />
      </div>
    </div>
  );
}


