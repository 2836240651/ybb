"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { syncLinesToWooAndCheckout } from "@/lib/woocommerce/store-api";
import { CartCheckoutAuthLinks } from "@/components/cart/CartCheckoutAuthLinks";
import { formatPrice } from "@/lib/data/products";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { useCart } from "@/lib/store/cart";
import { cn } from "@/lib/utils";

export function CartDrawer() {
  const { lines, isOpen, close, removeItem, updateQuantity, subtotal } =
    useCart();
  const { t } = useI18n();
  const [checkingOut, setCheckingOut] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    if (isOpen) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, close]);

  return (
    <>
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/40 transition-opacity duration-300",
          isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
        aria-hidden={!isOpen}
        onClick={close}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={t("cart.shoppingCart")}
        className={cn(
          "fixed top-0 right-0 z-50 flex h-full w-full max-w-full sm:max-w-md flex-col bg-white shadow-2xl transition-transform duration-500 ease-nav",
          isOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        <header className="flex items-center justify-between border-b border-border px-6 py-5">
          <h2 className="text-lg font-bold tracking-tight">{t("cart.yourCart")}</h2>
          <button
            type="button"
            onClick={close}
            className="rounded-full p-2 interaction-icon-hover transition-colors"
            aria-label={t("cart.closeCart")}
          >
            {"\u00D7"}
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {lines.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
              <p className="text-foreground/60">{t("cart.empty")}</p>
              <Link
                href="/collections/new-arrivals"
                onClick={close}
                className="text-[13px] underline underline-offset-2 hover:opacity-70 transition-opacity"
              >
                {t("cart.continueShopping")}
              </Link>
            </div>
          ) : (
            <ul className="flex flex-col gap-6">
              {lines.map((line) => (
                <li
                  key={`${line.handle}-${line.variant}`}
                  className="flex gap-4"
                >
                  <div className="relative h-24 w-20 shrink-0 overflow-hidden rounded-card bg-neutral-100">
                    <Image
                      src={line.image}
                      alt={line.title}
                      fill
                      sizes="80px"
                      className="object-cover"
                    />
                  </div>
                  <div className="flex flex-1 flex-col gap-2 min-w-0">
                    <Link
                      href={`/products/${line.handle}`}
                      onClick={close}
                      className="font-medium text-sm line-clamp-2 hover:opacity-70"
                    >
                      {line.title}
                    </Link>
                    <p className="text-xs text-foreground/50">{line.sku || line.variant}</p>
                    <p className="text-sm font-medium">
                      {formatPrice(line.price)}
                    </p>
                    <div className="flex items-center gap-3 mt-auto">
                      <div className="inline-flex items-center rounded-input border border-border">
                        <button
                          type="button"
                          className="px-2.5 py-1 text-sm hover:bg-neutral-50"
                          aria-label={t("common.decreaseQuantity")}
                          onClick={() =>
                            updateQuantity(
                              line.handle,
                              line.variant,
                              line.quantity - 1
                            )
                          }
                        >
                          {"\u2212"}
                        </button>
                        <span className="min-w-[2rem] text-center text-sm">
                          {line.quantity}
                        </span>
                        <button
                          type="button"
                          className="px-2.5 py-1 text-sm hover:bg-neutral-50"
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
          )}
        </div>

        {lines.length > 0 && (
          <footer className="border-t border-border px-6 py-5 space-y-4">
            <div className="flex justify-between text-sm">
              <span className="text-foreground/60">{t("cart.subtotal")}</span>
              <span className="font-medium">{formatPrice(subtotal())}</span>
            </div>
            {checkoutError ? (
              <p className="text-xs text-red-600">{checkoutError}</p>
            ) : null}
            <CartCheckoutAuthLinks
              hint={t("cart.checkoutAuthHint")}
              signInLabel={t("account.signIn")}
              registerLabel={t("account.register")}
            />
            <a
              href="/cart/"
              className="block text-center text-xs text-foreground/60 underline underline-offset-2 hover:opacity-80"
            >
              {t("cart.viewWpCart")}
            </a>
            <button
              type="button"
              disabled={checkingOut}
              className="w-full rounded-pill bg-foreground text-background py-3.5 text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
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
          </footer>
        )}
      </aside>
    </>
  );
}
