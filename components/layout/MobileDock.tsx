"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useCart } from "@/lib/store/cart";
import { useUI } from "@/lib/store/ui";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { cn } from "@/lib/utils";

type DockItem = {
  labelKey: string;
  icon: string;
  action: "link" | "search" | "menu" | "cart";
  href?: string;
  match?: (path: string) => boolean;
};

export function MobileDock() {
  const pathname = usePathname();
  const { openSearch, toggleMobileNav, mobileNavOpen } = useUI();
  const { open: openCart, itemCount, isOpen: cartOpen } = useCart();
  const { t } = useI18n();
  const [mounted, setMounted] = useState(false);

  const items = useMemo<DockItem[]>(
    () => [
      {
        labelKey: "dock.home",
        icon: "�?,
        action: "link",
        href: "/",
        match: (path) => path === "/",
      },
      { labelKey: "dock.menu", icon: "�?, action: "menu" },
      { labelKey: "dock.search", icon: "�?, action: "search" },
      {
        labelKey: "dock.shop",
        icon: "�?,
        action: "link",
        href: "/collections/new-arrivals",
        match: (path) => path.startsWith("/collections"),
      },
      { labelKey: "dock.cart", icon: "🛒", action: "cart" },
      {
        labelKey: "dock.account",
        icon: "�?,
        action: "link",
        href: "/my-account",
        match: (path) => path.startsWith("/my-account"),
      },
    ],
    []
  );

  useEffect(() => setMounted(true), []);

  const count = mounted ? itemCount() : 0;

  const isActive = (item: DockItem) => {
    const currentPath = pathname ?? "";
    if (item.action === "menu") return mobileNavOpen;
    if (item.action === "cart") return cartOpen;
    if (item.match) return item.match(currentPath);
    return false;
  };

  const itemClass = (item: DockItem) =>
    cn(
      "flex w-full flex-col items-center justify-center gap-0.5 py-2 min-h-[56px] transition-colors",
      isActive(item)
        ? "text-foreground font-medium"
        : "text-foreground/50 hover:text-foreground"
    );

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-30 border-t border-border bg-white/95 backdrop-blur pb-safe lg:hidden"
      aria-label="Mobile dock"
    >
      <ul className="flex items-stretch justify-around">
        {items.map((item) => {
          const label = t(item.labelKey);
          const handleClick = () => {
            if (item.action === "search") openSearch();
            else if (item.action === "menu") toggleMobileNav();
            else if (item.action === "cart") openCart();
          };

          const content = (
            <>
              <span className="text-lg leading-none relative" aria-hidden>
                {item.icon}
                {item.action === "cart" && count > 0 && (
                  <span className="absolute -top-1.5 -right-2 flex h-3.5 min-w-3.5 items-center justify-center rounded-pill bg-foreground px-0.5 text-[9px] text-background">
                    {count > 9 ? "9+" : count}
                  </span>
                )}
              </span>
              <span className="text-[10px] font-medium">{label}</span>
            </>
          );

          return (
            <li key={item.labelKey} className="flex-1 min-w-0">
              {item.action === "link" && item.href ? (
                <Link href={item.href} className={itemClass(item)}>
                  {content}
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={handleClick}
                  className={itemClass(item)}
                  aria-label={label}
                  aria-current={isActive(item) ? "page" : undefined}
                >
                  {content}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
