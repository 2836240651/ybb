"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import navigation from "@/lib/data/navigation.json";
import {
  fetchNavigation,
  type YbbNavItem,
  type YbbNavigationResponse,
} from "@/lib/site-manager/navigation-api";
import { footerLinksFromNav } from "@/lib/site-manager/nav-sync";
import { withWholesaleNav } from "@/lib/site-manager/wholesale-nav";

/** v4 �?wholesale mega menu prepended client-side. */
const NAV_CACHE_KEY = "ybb:site-manager:navigation:v4";

function readNavigationCache(): YbbNavigationResponse | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const raw = sessionStorage.getItem(NAV_CACHE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as YbbNavigationResponse;
    if (!parsed?.primaryNav?.length || !parsed.syncedAt) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function writeNavigationCache(data: YbbNavigationResponse): void {
  if (!data.syncedAt) {
    return;
  }
  try {
    sessionStorage.setItem(NAV_CACHE_KEY, JSON.stringify(data));
    sessionStorage.removeItem("ybb:site-manager:navigation:v1");
    sessionStorage.removeItem("ybb:site-manager:navigation:v2");
  } catch {
    // ignore quota / private mode
  }
}

type NavigationContextValue = {
  primaryNav: YbbNavItem[];
  footerQuickLinks: Array<{ label: string; href: string }>;
  footerSocial: Array<{ label: string; href: string }> | null;
  ready: boolean;
  syncedAt: string | null;
};

const NavigationContext = createContext<NavigationContextValue | null>(null);

const staticPrimaryNav = withWholesaleNav(navigation.primaryNav as YbbNavItem[]);
const staticFooterQuickLinks = footerLinksFromNav(
  undefined,
  navigation.footer.quickLinks as Array<{ label: string; href: string }>
);

function applyNavigation(
  data: YbbNavigationResponse,
  setters: {
    setPrimaryNav: (nav: YbbNavItem[]) => void;
    setFooterQuickLinks: (links: Array<{ label: string; href: string }>) => void;
    setFooterSocial: (social: Array<{ label: string; href: string }> | null) => void;
    setSyncedAt: (at: string | null) => void;
  }
): void {
  if (data.primaryNav?.length) {
    setters.setPrimaryNav(withWholesaleNav(data.primaryNav));
  }
  setters.setFooterQuickLinks(
    footerLinksFromNav(data.footer?.quickLinks, staticFooterQuickLinks, data.primaryNav ?? [])
  );
  if (data.footer?.social?.length) {
    setters.setFooterSocial(data.footer.social);
  }
  setters.setSyncedAt(data.syncedAt ?? null);
  writeNavigationCache(data);
}

export function NavigationProvider({ children }: { children: ReactNode }) {
  const [primaryNav, setPrimaryNav] = useState<YbbNavItem[]>(staticPrimaryNav);
  const [footerQuickLinks, setFooterQuickLinks] = useState(staticFooterQuickLinks);
  const [footerSocial, setFooterSocial] = useState<
    Array<{ label: string; href: string }> | null
  >(null);
  const [syncedAt, setSyncedAt] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void fetchNavigation().then((data) => {
      if (cancelled) {
        return;
      }

      if (data?.primaryNav?.length) {
        applyNavigation(data, {
          setPrimaryNav,
          setFooterQuickLinks,
          setFooterSocial,
          setSyncedAt,
        });
      } else {
        const cached = readNavigationCache();
        if (cached?.primaryNav?.length) {
          applyNavigation(cached, {
            setPrimaryNav,
            setFooterQuickLinks,
            setFooterSocial,
            setSyncedAt,
          });
        } else {
          setPrimaryNav(staticPrimaryNav);
          setFooterQuickLinks(staticFooterQuickLinks);
          setFooterSocial(navigation.footer.social);
        }
      }

      setReady(true);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo(
    () => ({
      primaryNav,
      footerQuickLinks,
      footerSocial,
      ready,
      syncedAt,
    }),
    [primaryNav, footerQuickLinks, footerSocial, ready, syncedAt]
  );

  return (
    <NavigationContext.Provider value={value}>{children}</NavigationContext.Provider>
  );
}

export function useSiteNavigation(): NavigationContextValue {
  const ctx = useContext(NavigationContext);
  if (!ctx) {
    throw new Error("useSiteNavigation must be used within NavigationProvider");
  }

  return ctx;
}
