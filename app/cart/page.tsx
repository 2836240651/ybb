"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { formatPrice } from "@/lib/data/products";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { useCart } from "@/lib/store/cart";
import { syncLinesToWooAndCheckout } from "@/lib/woocommerce/store-api";
import { CartCheckoutAuthLinks } from "@/components/cart/CartCheckoutAuthLinks";

export default function CartPage() {
  const { lines, removeItem, updateQuantity, subtotal, clear, open } = useCart();
  const { t } = useI18n();
  const [checkingOut, setCheckingOut] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  if (lines.length === 0) {
    return (
      <div className="page-container py-16 md:py-20 text-center">
        <h1 className="sr-only">{t("cart.yourCart")}</h1>
        <p className="text-title-md mb-3">{t("cart.yourCart")}</p>
        <p className="text-foreground/60 mb-8 text-sm md:text-base">
          {t("cart.emptyPage")}
        </p>
        <div className="flex flex-col items-center gap-2">
          <Link
            href="/collections/new-arrivals"
            className="cart-empty__cta text-[13px] underline underline-offset-2 hover:opacity-70 transition-opacity"
          >
            {t("cart.continueShopping")}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container py-10 md:py-16">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-10">
        <div>
          <h1 className="text-title-md mb-2">{t("cart.yourCart")}</h1>
          <p className="text-sm text-foreground/60">{t("cart.demoNote")}</p>
        </div>
        <button
          type="button"
          onClick={clear}
          className="text-sm text-foreground/50 underline-offset-2 hover:underline"
        >
          {t("cart.clearCart")}
        </button>
      </div>

      <ul className="divide-y divide-border border-y border-border">
        {lines.map((line) => (
          <li
            key={`${line.handle}-${line.variant}`}
            className="flex gap-4 py-6 md:py-7"
          >
            <div className="relative h-28 w-24 shrink-0 overflow-hidden rounded-card bg-neutral-100">
              <Image
                src={line.image}
                alt={line.title}
                fill
                sizes="96px"
                className="object-cover"
              />
            </div>
            <div className="flex flex-1 flex-col gap-2 min-w-0 sm:flex-row sm:justify-between">
              <div>
                <Link
                  href={`/products/${line.handle}`}
                  className="font-medium hover:opacity-70"
                >
                  {line.title}
                </Link>
                <p className="text-xs text-foreground/50 mt-1">{line.sku || line.variant}</p>
              </div>
              <div className="flex flex-col items-start sm:items-end gap-2.5">
                <p className="font-medium text-product">{formatPrice(line.price)}</p>
                <div className="inline-flex items-center rounded-input border border-border">
                  <button
                    type="button"
                    className="px-3 py-1.5 text-sm hover:bg-neutral-50"
                    aria-label={t("common.decreaseQuantity")}
                    onClick={() =>
                      updateQuantity(
                        line.handle,
                        line.variant,
                        line.quantity - 1
                      )
                    }
                  >
                    �?
                  </button>
                  <span className="min-w-[2rem] text-center text-sm">
                    {line.quantity}
                  </span>
                  <button
                    type="button"
                    className="px-3 py-1.5 text-sm hover:bg-neutral-50"
                    aria-label={t("common.increaseQuantity")}
                    onClick={() =>
                      updateQuantity(
                        line.handle,
                        line.variant,
                        line.quantity + 1
                      )
                    }
                  >
                    +
                  </button>
                </div>
                <button
                  type="button"
                  className="text-xs text-foreground/50 underline-offset-2 hover:underline"
                  onClick={() => removeItem(line.handle, line.variant)}
                >
                  {t("common.remove")}
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>

      <footer className="mt-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6 border-t border-border pt-8">
        <div>
          <p className="text-sm text-foreground/60">{t("cart.subtotal")}</p>
          <p className="text-2xl font-bold">{formatPrice(subtotal())}</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
          <button
            type="button"
            onClick={open}
            className="rounded-pill border border-border px-6 py-3 text-sm font-medium hover:bg-neutral-50 transition-colors"
          >
            {t("cart.quickViewDrawer")}
          </button>
          <div className="flex flex-col gap-2">
            {checkoutError ? (
              <p className="text-xs text-red-600">{checkoutError}</p>
            ) : null}
            <CartCheckoutAuthLinks
              hint={t("cart.checkoutAuthHint")}
              signInLabel={t("account.signIn")}
              registerLabel={t("account.register")}
            />
            <button
            type="button"
            disabled={checkingOut}
            className="inline-flex items-center justify-center rounded-pill bg-foreground text-background px-6 py-3 text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
            onClick={async () => {
              setCheckoutError(null);
              setCheckingOut(true);
              try {
                await syncLinesToWooAndCheckout(lines);
              } catch (err) {
                setCheckoutError(err instanceof Error ? err.message : "Checkout failed");
                setCheckingOut(false);
              }
            }}
          >
            {checkingOut ? "..." : t("cart.requestQuote")}
          </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
