"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { CartToggle } from "@/components/cart/CartToggle";
import { BrandLogo } from "@/components/layout/BrandLogo";
import { ContactUsPill } from "@/components/layout/ContactUsPill";
import { WhatsAppPill } from "@/components/layout/WhatsAppPill";
import { useSiteNavigation } from "@/lib/site-manager/NavigationProvider";
import { resolveNavLabel } from "@/lib/site-manager/labels";
import { HEADER_STICKY_SCROLL, useHeaderScroll } from "@/hooks/useHeaderScroll";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { useUI } from "@/lib/store/ui";
import { cn } from "@/lib/utils";
import {
  MegaMenuPanel,
  NavMegaMenuTrigger,
  type NavItem,
} from "./MegaMenu";
import { NavPillLink } from "./NavPill";

const CLOSE_DELAY_MS = 200;

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

function AccountIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <circle cx="12" cy="8" r="4" />
      <path d="M5 20c0-4 3.5-6 7-6s7 2 7 6" />
    </svg>
  );
}

function MenuIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      className={className}
      aria-hidden
    >
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

export function Header() {
  const pathname = usePathname();
  const { openSearch, toggleMobileNav } = useUI();
  const { t, tl, locale } = useI18n();
  const headerHidden = useHeaderScroll();
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navHoverRef = useRef(false);
  const panelHoverRef = useRef(false);
  const { primaryNav: navItems, ready } = useSiteNavigation();

  const navLabel = (item: NavItem) => resolveNavLabel(item, locale, tl);

  const activeItem =
    navItems.find((item) => item.label === activeMenu) ?? null;

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY >= HEADER_STICKY_SCROLL);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (headerHidden) setActiveMenu(null);
  }, [headerHidden]);

  const cancelClose = useCallback(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const scheduleClose = useCallback(() => {
    cancelClose();
    closeTimerRef.current = setTimeout(() => {
      if (!navHoverRef.current && !panelHoverRef.current) {
        setActiveMenu(null);
      }
    }, CLOSE_DELAY_MS);
  }, [cancelClose]);

  const openMenu = useCallback(
    (label: string) => {
      cancelClose();
      setActiveMenu(label);
    },
    [cancelClose]
  );

  const closeMenu = useCallback(() => {
    cancelClose();
    navHoverRef.current = false;
    panelHoverRef.current = false;
    setActiveMenu(null);
  }, [cancelClose]);

  /** Route change must reset mega menu �?stale open panel blocks category switches. */
  useEffect(() => {
    closeMenu();
  }, [pathname, closeMenu]);

  const handleNavEnter = useCallback(() => {
    navHoverRef.current = true;
    cancelClose();
  }, [cancelClose]);

  const handleNavLeave = useCallback(() => {
    navHoverRef.current = false;
    scheduleClose();
  }, [scheduleClose]);

  const handlePanelEnter = useCallback(() => {
    panelHoverRef.current = true;
    cancelClose();
  }, [cancelClose]);

  const handlePanelLeave = useCallback(() => {
    panelHoverRef.current = false;
    scheduleClose();
  }, [scheduleClose]);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    };
  }, []);

  return (
    <div
      className={cn(
        "site-header-sticky",
        scrolled && "site-header-sticky--scrolled",
        headerHidden && !activeMenu && "site-header-sticky--hidden",
        activeMenu && "site-header-sticky--mega-open"
      )}
    >
      <header className="site-header relative bg-white/95 backdrop-blur border-b border-border">
        {/* Mobile: hamburger | logo | search + cart */}
        <div
          className="page-container lg:hidden flex items-center gap-2"
          style={{
            paddingBlock: "var(--header-padding-block)",
            paddingInline: "var(--header-padding-inline)",
          }}
        >
          <button
            type="button"
            className="touch-target inline-flex items-center justify-center rounded-full interaction-icon-hover transition-colors -ml-2 shrink-0"
            aria-label={t("common.openMenu")}
            onClick={toggleMobileNav}
          >
            <MenuIcon className="h-6 w-6" />
          </button>

          <BrandLogo
            showText={false}
            layout="stacked"
            className="flex-1 items-center justify-center text-center"
            imageClassName="h-10 w-10"
          />

          <div className="flex items-center gap-2 shrink-0">
            <ContactUsPill compact />
            <WhatsAppPill compact />
            <button
              type="button"
              aria-label={t("common.search")}
              className="touch-target inline-flex items-center justify-center rounded-full interaction-icon-hover transition-colors"
              onClick={openSearch}
            >
              <SearchIcon className="h-5 w-5" />
            </button>
            <div className="touch-target inline-flex items-center justify-center">
              <CartToggle iconOnly />
            </div>
          </div>
        </div>

        {/* Desktop: 3-zone grid �?logo left | nav center | icons right */}
        <div
          className="page-container hidden lg:grid header-desktop-grid items-center"
          style={{
            paddingBlock: "var(--header-padding-block)",
          }}
        >
          <BrandLogo showText={false} className="justify-self-start" />

          <nav
            className="header-nav-zone flex items-center justify-start text-nav"
            aria-label={t("common.primaryNavigation")}
            onMouseEnter={handleNavEnter}
            onMouseLeave={handleNavLeave}
          >
            <ul className="header-nav-list flex items-center">
              {(ready ? navItems : []).map((item) =>
                item.megaMenu ? (
                  <NavMegaMenuTrigger
                    key={item.label}
                    item={item}
                    isActive={activeMenu === item.label}
                    onOpen={() => openMenu(item.label)}
                  />
                ) : (
                  <li key={item.label}>
                    <NavPillLink href={item.href}>{navLabel(item)}</NavPillLink>
                  </li>
                )
              )}
            </ul>
          </nav>

          <div className="header-utilities-zone flex items-center justify-end justify-self-end shrink-0 gap-1.5">
            <ContactUsPill />
            <WhatsAppPill />
            <button
              type="button"
              aria-label={t("common.search")}
              className="header-utility-icon interaction-icon-hover"
              onClick={openSearch}
            >
              <SearchIcon className="h-5 w-5" />
            </button>
            <Link
              href="/my-account"
              aria-label={t("common.account")}
              className="header-utility-icon interaction-icon-hover"
            >
              <AccountIcon className="h-5 w-5" />
            </Link>
            <CartToggle iconOnly />
          </div>
        </div>
      </header>

      <MegaMenuPanel
        item={activeItem}
        open={!!activeItem?.megaMenu}
        onClose={closeMenu}
        onMouseEnter={handlePanelEnter}
        onMouseLeave={handlePanelLeave}
      />
    </div>
  );
}
