"use client";

import Link from "next/link";
import { useEffect, useState, type CSSProperties } from "react";
import { getBrandName, getBrandTagline } from "@/lib/brand";
import { useSiteNavigation } from "@/lib/site-manager/NavigationProvider";
import { resolveNavLabel } from "@/lib/site-manager/labels";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { useUI } from "@/lib/store/ui";
import { cn } from "@/lib/utils";
import type { NavItem } from "./MegaMenu";

export function MobileNavDrawer() {
  const { mobileNavOpen, closeMobileNav } = useUI();
  const { locale, t, tl } = useI18n();
  const brandName = getBrandName();
  const brandTagline = getBrandTagline(locale);
  const [expanded, setExpanded] = useState<string | null>(null);
  const { primaryNav: navItems, ready } = useSiteNavigation();
  const navLabel = (item: NavItem) => resolveNavLabel(item, locale, tl);

  useEffect(() => {
    document.body.style.overflow = mobileNavOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileNavOpen]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeMobileNav();
    };
    if (mobileNavOpen) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileNavOpen, closeMobileNav]);

  useEffect(() => {
    if (!mobileNavOpen) setExpanded(null);
  }, [mobileNavOpen]);

  const toggleSection = (label: string) => {
    setExpanded((current) => (current === label ? null : label));
  };

  return (
    <>
      <div
        className={cn(
          "mobile-nav-overlay fixed inset-0 z-40 bg-black/40 lg:hidden",
          mobileNavOpen
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none"
        )}
        aria-hidden={!mobileNavOpen}
        onClick={closeMobileNav}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={t("common.primaryNavigation")}
        aria-hidden={!mobileNavOpen}
        className={cn(
          "mobile-nav-drawer fixed inset-0 z-50 flex h-full w-full flex-col bg-white lg:hidden",
          mobileNavOpen ? "mobile-nav-drawer--open" : "mobile-nav-drawer--closed"
        )}
        style={
          {
            "--mobile-nav-item-count": navItems.length,
          } as CSSProperties
        }
      >
        <header className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="min-w-0">
            <p className="font-bold uppercase tracking-tight">{brandName}</p>
            <p className="header-logo-tagline mt-0.5 line-clamp-2">{brandTagline}</p>
          </div>
          <button
            type="button"
            onClick={closeMobileNav}
            className="touch-target inline-flex items-center justify-center rounded-full interaction-icon-hover transition-colors"
            aria-label={t("common.closeMenu")}
          >
            �?          </button>
        </header>

        <nav className="flex-1 overflow-y-auto px-5 py-4" aria-label="Mobile">
          <ul className="space-y-0">
            {(ready ? navItems : []).map((item, index) => {
              const hasSubmenu = !!item.megaMenu;
              const isOpen = expanded === item.label;

              return (
                <li
                  key={item.label}
                  className="mobile-nav-item border-b border-border/60"
                  style={
                    { "--mobile-nav-stagger-index": index } as CSSProperties
                  }
                >
                  {hasSubmenu ? (
                    <>
                      <button
                        type="button"
                        className="touch-target flex w-full items-center justify-between py-4 text-base font-medium text-left"
                        aria-expanded={isOpen}
                        onClick={() => toggleSection(item.label)}
                      >
                        {navLabel(item)}
                        <span className="text-lg leading-none opacity-50" aria-hidden>
                          {isOpen ? "�? : "+"}
                        </span>
                      </button>
                        <div
                        className={cn(
                          "overflow-hidden transition-[max-height,opacity] duration-300 ease-primary",
                          isOpen
                            ? cn(
                                "pb-4 opacity-100",
                                item.megaMenu!.children.length > 12
                                  ? "max-h-[80vh]"
                                  : "max-h-[32rem]"
                              )
                            : "max-h-0 opacity-0"
                        )}
                      >
                        <ul className="space-y-3 pl-1">
                          {item.megaMenu!.children.map((link) => (
                            <li key={link.href}>
                              <Link
                                href={link.href}
                                onClick={closeMobileNav}
                                className="block py-1 text-sm text-foreground/60 hover:text-foreground"
                              >
                                {resolveNavLabel(link, locale, tl)}
                              </Link>
                            </li>
                          ))}
                          <li>
                            <Link
                              href={item.megaMenu!.shopAll.href}
                              onClick={closeMobileNav}
                              className="block py-1 text-sm font-medium underline-offset-4 hover:underline"
                            >
                              {resolveNavLabel(item.megaMenu!.shopAll, locale, tl)}
                            </Link>
                          </li>
                        </ul>
                      </div>
                    </>
                  ) : (
                    <Link
                      href={item.href}
                      onClick={closeMobileNav}
                      className="touch-target flex items-center py-4 text-base font-medium"
                    >
                      {navLabel(item)}
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        </nav>

        <footer className="mobile-nav-footer border-t border-border px-5 py-4 pb-safe space-y-3">
          <Link
            href="/pages/contact"
            onClick={closeMobileNav}
            className="touch-target flex w-full items-center justify-center rounded-pill bg-foreground text-background py-3 text-sm font-medium"
          >
            {t("mobileNav.requestQuote")}
          </Link>
        </footer>
      </aside>
    </>
  );
}
