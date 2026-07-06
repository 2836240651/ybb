"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  formatPrice,
  getProductByHandle,
  getProductsByCollection,
} from "@/lib/data/products";
import { HardNavLink } from "@/lib/navigation/hard-nav-fallback";
import { resolveNavLabel } from "@/lib/site-manager/labels";
import type { TriLabels } from "@/lib/site-manager/labels";
import { useI18n, useProductTitle } from "@/lib/i18n/I18nProvider";
import type { Product } from "@/lib/types/product";
import { cn } from "@/lib/utils";
import { NavPillLink } from "./NavPill";

export type MegaMenuChild = {
  label: string;
  labels?: TriLabels;
  href: string;
  featuredProducts?: string[];
};

export type MegaMenuConfig = {
  children: MegaMenuChild[];
  shopAll: { label: string; labels?: TriLabels; href: string };
  /** OEM pages share one overview �?no collection sidebar / product grid */
  /** OEM / category link lists; wholesale = full catalog grid */
  variant?: "default" | "oem" | "category" | "wholesale";
};

export type NavItem = {
  label: string;
  labels?: TriLabels;
  href: string;
  megaMenu?: MegaMenuConfig & {
    shopAll: { label: string; labels?: TriLabels; href: string };
  };
};

type NavMegaMenuTriggerProps = {
  item: NavItem;
  isActive: boolean;
  onOpen: () => void;
};

type MegaMenuPanelProps = {
  item: NavItem | null;
  open: boolean;
  onClose: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
};

const CROSSFADE_MS = 300;
const CONTENT_ENTER_DELAY_MS = 180;
const SIDEBAR_CROSSFADE_MS = 200;

function collectionHandleFromHref(href: string): string | null {
  const match = href.match(/^\/collections\/([^/]+)/);
  return match ? match[1] : null;
}

function resolveChildProducts(child: MegaMenuChild): Product[] {
  if (child.featuredProducts?.length) {
    return child.featuredProducts
      .map((handle) => getProductByHandle(handle))
      .filter((product): product is Product => !!product)
      .slice(0, 4);
  }
  const handle = collectionHandleFromHref(child.href);
  if (handle) {
    return getProductsByCollection(handle).slice(0, 4);
  }
  return [];
}

function childProductCount(child: MegaMenuChild): number {
  if (child.featuredProducts?.length) {
    return child.featuredProducts.length;
  }
  const handle = collectionHandleFromHref(child.href);
  if (handle) {
    return getProductsByCollection(handle).length;
  }
  return 0;
}

type MegaMenuProductCardProps = {
  product: Product;
  index: number;
  onClose: () => void;
};

function MegaMenuProductCard({
  product,
  index,
  onClose,
}: MegaMenuProductCardProps) {
  const { t } = useI18n();
  const title = useProductTitle(product);
  const soldOut = !product.available;
  const onSale =
    product.compareAtPrice != null && product.compareAtPrice > product.price;

  return (
    <HardNavLink
      href={`/products/${product.handle}`}
      className="mega-menu-product-card group flex flex-col"
      style={{ "--mega-stagger-index": index } as React.CSSProperties}
      onClick={onClose}
    >
      <div className="mega-menu-product-card__media relative aspect-square rounded-card transition-transform duration-500 ease-primary group-hover:scale-[1.02]">
        <Image
          src={product.images[0]}
          alt={title}
          fill
          sizes="(max-width: 1280px) 20vw, 240px"
          className="object-contain object-center p-3 rounded-card mix-blend-multiply transition-transform duration-500 ease-primary group-hover:scale-[1.02]"
        />
        {soldOut && (
          <span className="product-card-badge product-card-badge--sold-out absolute top-3 right-3 z-10 md:top-5 md:right-5">
            {t("product.soldOut")}
          </span>
        )}
      </div>
      <div className="mt-3 flex items-start justify-between gap-2">
        <p className="text-sm font-medium line-clamp-2 flex-1 min-w-0 group-hover:opacity-70 transition-opacity duration-500 ease-primary">
          {title}
        </p>
        <div className="shrink-0 text-right">
          <p className="text-sm font-medium">{formatPrice(product.price)}</p>
          {onSale && (
            <p className="text-xs text-foreground/40 line-through">
              {formatPrice(product.compareAtPrice!)}
            </p>
          )}
        </div>
      </div>
    </HardNavLink>
  );
}

export function NavMegaMenuTrigger({
  item,
  isActive,
  onOpen,
}: NavMegaMenuTriggerProps) {
  const { locale, tl } = useI18n();

  return (
    <li className="relative" onMouseEnter={onOpen}>
      <NavPillLink href={item.href} active={isActive} aria-expanded={isActive} aria-haspopup="true">
        {resolveNavLabel(item, locale, tl)}
        <span className="text-[10px] opacity-50" aria-hidden>
          �?        </span>
      </NavPillLink>
    </li>
  );
}

export function MegaMenuPanel({
  item,
  open,
  onClose,
  onMouseEnter,
  onMouseLeave,
}: MegaMenuPanelProps) {
  const pathname = usePathname();
  const { locale, tl, t } = useI18n();
  const labelFor = (entry: { label: string; labels?: TriLabels }) =>
    resolveNavLabel(entry, locale, tl);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [displayItem, setDisplayItem] = useState<NavItem | null>(null);
  const [contentVisible, setContentVisible] = useState(false);
  const [contentExiting, setContentExiting] = useState(false);
  const [activeChildIndex, setActiveChildIndex] = useState(0);
  const [displayProducts, setDisplayProducts] = useState<Product[]>([]);
  const [productsExiting, setProductsExiting] = useState(false);
  const prevItemLabelRef = useRef<string | null>(null);
  const prevChildHrefRef = useRef<string | null>(null);
  const switchingRef = useRef(false);

  useEffect(() => {
    setReduceMotion(
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
  }, []);

  useEffect(() => {
    switchingRef.current = false;
    setContentExiting(false);
    setProductsExiting(false);
    setContentVisible(false);
    setActiveChildIndex(0);
    prevChildHrefRef.current = null;
  }, [pathname]);

  useEffect(() => {
    if (!open || !item) {
      setContentVisible(false);
      setContentExiting(false);
      if (!open) {
        prevItemLabelRef.current = null;
        setActiveChildIndex(0);
        prevChildHrefRef.current = null;
        const resetTimer = window.setTimeout(() => setDisplayItem(null), 500);
        return () => window.clearTimeout(resetTimer);
      }
      return;
    }

    const prevLabel = prevItemLabelRef.current;
    const isSwitch = prevLabel != null && prevLabel !== item.label;

    if (isSwitch) {
      switchingRef.current = true;
      setContentVisible(false);
      setContentExiting(true);
      setActiveChildIndex(0);
      prevChildHrefRef.current = null;

      const fadeMs = reduceMotion ? 0 : CROSSFADE_MS;
      const timer = window.setTimeout(() => {
        setDisplayItem(item);
        prevItemLabelRef.current = item.label;
        setContentExiting(false);
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            setContentVisible(true);
            switchingRef.current = false;
          });
        });
      }, fadeMs);

      return () => {
        window.clearTimeout(timer);
        switchingRef.current = false;
      };
    }

    setDisplayItem(item);
    prevItemLabelRef.current = item.label;
    setActiveChildIndex(0);
    setContentExiting(false);
    setContentVisible(false);
    const enterDelay = reduceMotion ? 0 : CONTENT_ENTER_DELAY_MS;
    const timer = window.setTimeout(() => {
      requestAnimationFrame(() => setContentVisible(true));
    }, enterDelay);
    return () => window.clearTimeout(timer);
  }, [open, item, reduceMotion]);

  const megaMenu = displayItem?.megaMenu;
  const isOemMega = megaMenu?.variant === "oem";
  const isWholesaleMega = megaMenu?.variant === "wholesale";
  const isLinkDrawer =
    isOemMega || megaMenu?.variant === "category" || isWholesaleMega;
  const activeChild = megaMenu?.children[activeChildIndex] ?? null;

  useEffect(() => {
    if (!activeChild) {
      setDisplayProducts([]);
      prevChildHrefRef.current = null;
      return;
    }
    const nextProducts = resolveChildProducts(activeChild);
    const childHref = activeChild.href;
    const isChildSwitch =
      prevChildHrefRef.current != null &&
      prevChildHrefRef.current !== childHref;
    prevChildHrefRef.current = childHref;

    if (!isChildSwitch) {
      setDisplayProducts(nextProducts);
      setProductsExiting(false);
      return;
    }

    setProductsExiting(true);
    const fadeMs = reduceMotion ? 0 : SIDEBAR_CROSSFADE_MS;
    const timer = window.setTimeout(() => {
      setDisplayProducts(nextProducts);
      setProductsExiting(false);
    }, fadeMs);
    return () => window.clearTimeout(timer);
  }, [activeChild, reduceMotion]);

  const handleSidebarEnter = useCallback((index: number) => {
    setActiveChildIndex((prev) => (prev === index ? prev : index));
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const sidebarCount = megaMenu?.children.length ?? 0;
  const productCount = activeChild ? childProductCount(activeChild) : 0;
  const viewAllHref = activeChild?.href ?? displayItem?.href ?? "#";
  const viewAllLabel = activeChild ? labelFor(activeChild) : "";

  return (
    <div
      className={cn(
        "mega-menu-panel absolute left-0 right-0 top-full z-30 bg-white hidden lg:block",
        reduceMotion && "motion-reduce:!transition-none",
        open ? "mega-menu-panel--open" : "mega-menu-panel--closed"
      )}
      aria-hidden={!open}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div className="mega-menu-hover-bridge" aria-hidden />
      {megaMenu && displayItem && megaMenu.children.length > 0 && (
        <div
          key={displayItem.label}
          className={cn(
            "mega-menu-content page-container py-12",
            reduceMotion && "motion-reduce:!transition-none",
            contentExiting && "mega-menu-content--exiting",
            contentVisible && open && "mega-menu-content--visible",
            isLinkDrawer && "mega-menu-content--oem"
          )}
          style={
            isLinkDrawer
              ? undefined
              : ({
                  "--mega-sidebar-count": sidebarCount,
                } as React.CSSProperties)
          }
        >
          {isLinkDrawer ? (
            isWholesaleMega ? (
              <div className="mega-menu-wholesale mx-auto max-w-6xl py-2">
                <p className="mega-menu-heading text-xs font-medium uppercase tracking-widest text-foreground/45 mb-4 text-center">
                  {labelFor(displayItem)}
                </p>
                <h3 className="text-[clamp(1.5rem,2.5vw,2rem)] font-bold tracking-tight mb-8 text-center">
                  {labelFor(displayItem)}
                </h3>
                <ul
                  className="mega-menu-wholesale-grid grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3 lg:grid-cols-4 mb-8"
                  role="list"
                  style={
                    {
                      "--mega-sidebar-count": sidebarCount,
                    } as React.CSSProperties
                  }
                >
                  {megaMenu.children.map((child, index) => (
                    <li key={child.href}>
                      <HardNavLink
                        href={child.href}
                        className="mega-menu-wholesale-link interaction-link-fill block py-2 text-sm font-medium text-left"
                        style={
                          {
                            "--mega-stagger-index": index,
                          } as React.CSSProperties
                        }
                        onClick={onClose}
                      >
                        {labelFor(child)}
                      </HardNavLink>
                    </li>
                  ))}
                </ul>
                <HardNavLink
                  href={megaMenu.shopAll.href}
                  className="mega-menu-shop-all interaction-link-fill inline-flex items-center gap-1 text-sm font-bold border-t border-border pt-6 w-full justify-center"
                  onClick={onClose}
                >
                  {labelFor(megaMenu.shopAll)} �?                </HardNavLink>
              </div>
            ) : (
            <div className="mega-menu-oem mx-auto max-w-3xl text-center py-4">
              <p className="mega-menu-heading text-xs font-medium uppercase tracking-widest text-foreground/45 mb-4">
                {isOemMega ? t("labels.oem-odm") : labelFor(displayItem)}
              </p>
              {isOemMega ? (
                <>
                  <h3 className="text-[clamp(1.5rem,2.5vw,2rem)] font-bold tracking-tight mb-4">
                    {t("oemOverview.title")}
                  </h3>
                  <p className="text-sm text-foreground/65 leading-relaxed mb-8 max-w-2xl mx-auto">
                    {t("oemOverview.odm.p1")}
                  </p>
                </>
              ) : (
                <h3 className="text-[clamp(1.5rem,2.5vw,2rem)] font-bold tracking-tight mb-8">
                  {labelFor(displayItem)}
                </h3>
              )}
              <ul className="flex flex-col gap-3 mb-8" role="list">
                {megaMenu.children.map((child) => (
                  <li key={child.href}>
                    <HardNavLink
                      href={child.href}
                      className="mega-menu-oem-link interaction-link-fill text-base font-bold"
                      onClick={onClose}
                    >
                      {labelFor(child)} �?                    </HardNavLink>
                  </li>
                ))}
              </ul>
                    <HardNavLink
                href={megaMenu.shopAll.href}
                className="mega-menu-shop-all interaction-link-fill inline-flex items-center gap-1 text-sm font-bold border-t border-border pt-6 w-full justify-center"
                onClick={onClose}
              >
                {labelFor(megaMenu.shopAll)} �?              </HardNavLink>
            </div>
            )
          ) : (
          <div className="mega-menu-layout grid gap-10 lg:grid-cols-[minmax(200px,240px)_1fr] lg:items-start lg:gap-16">
            <div className="mega-menu-sidebar flex flex-col min-h-[280px]">
              <p className="mega-menu-heading text-xs font-medium uppercase tracking-widest text-foreground/45 mb-6">
                {t("common.collections")}
              </p>
              <ul className="flex flex-col gap-3" role="list">
                {megaMenu.children.map((child, index) => {
                  const isActive = index === activeChildIndex;
                  return (
                    <li key={child.href}>
                      <HardNavLink
                        href={child.href}
                        className={cn(
                          "mega-menu-sidebar-link interaction-sidebar-link block text-[clamp(1.25rem,1.5vw,1.75rem)] font-bold leading-tight tracking-tight",
                          isActive
                            ? "mega-menu-sidebar-link--active text-foreground"
                            : "text-foreground/35 hover:text-foreground/60"
                        )}
                        style={
                          {
                            "--mega-stagger-index": index,
                          } as React.CSSProperties
                        }
                        onMouseEnter={() => handleSidebarEnter(index)}
                        onFocus={() => handleSidebarEnter(index)}
                        onClick={onClose}
                        aria-current={isActive ? "true" : undefined}
                      >
                        {labelFor(child)}
                      </HardNavLink>
                    </li>
                  );
                })}
              </ul>
              <div className="mt-auto pt-8 border-t border-border">
                <HardNavLink
                  href={megaMenu.shopAll.href}
                  className="mega-menu-shop-all interaction-link-fill inline-flex items-center gap-1 text-sm font-bold"
                  onClick={onClose}
                >
                  {labelFor(megaMenu.shopAll)} �?                </HardNavLink>
              </div>
            </div>

            <div
              className={cn(
                "mega-menu-main hidden lg:block min-w-0",
                displayProducts.length === 0 && "mega-menu-main--empty"
              )}
              aria-hidden={displayProducts.length === 0}
            >
              {displayProducts.length > 0 ? (
                <>
                  <div className="mega-menu-featured-header flex items-baseline justify-between gap-4 mb-6">
                    <p className="mega-menu-heading text-xs font-medium uppercase tracking-widest text-foreground/45">
                      Best Sellers
                    </p>
                    {activeChild && (
                      <HardNavLink
                        href={viewAllHref}
                        className="mega-menu-view-all interaction-link-fill text-sm font-bold shrink-0"
                        onClick={onClose}
                      >
                        All {viewAllLabel}
                        {productCount > 0 ? ` (${productCount})` : ""} �?                      </HardNavLink>
                    )}
                  </div>
                  <div
                    className={cn(
                      "mega-menu-product-grid grid grid-cols-4 gap-4 xl:gap-6",
                      productsExiting && "mega-menu-product-grid--exiting",
                      !productsExiting &&
                        contentVisible &&
                        "mega-menu-product-grid--visible"
                    )}
                  >
                    {displayProducts.map((product, index) => (
                      <MegaMenuProductCard
                        key={`${activeChild?.href}-${product.handle}`}
                        product={product}
                        index={index}
                        onClose={onClose}
                      />
                    ))}
                  </div>
                </>
              ) : null}
            </div>
          </div>
          )}
        </div>
      )}
    </div>
  );
}
