import type { YbbNavItem } from "@/lib/site-manager/navigation-api";
import {
  isOtherChildHandle,
  wholesaleCarouselHandles,
  type WholesaleCarouselHandle,
} from "@/lib/data/catalog";

/** `/collections/rigs` �?`rigs` */
export function collectionHandleFromHref(href: string): string | null {
  const match = href.match(/^\/collections\/([^/?#]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

export function visibleCollectionHandles(primaryNav: YbbNavItem[]): Set<string> {
  const handles = new Set<string>();
  for (const item of primaryNav) {
    const handle = collectionHandleFromHref(item.href);
    if (handle) {
      handles.add(handle);
    }
    for (const child of item.megaMenu?.children ?? []) {
      const childHandle = collectionHandleFromHref(child.href);
      if (childHandle) {
        handles.add(childHandle);
      }
    }
  }

  return handles;
}

/** Homepage wholesale carousel �?only categories still visible in WP primary nav. */
export function wholesaleHandlesForNav(
  primaryNav: YbbNavItem[],
  ready: boolean
): WholesaleCarouselHandle[] {
  if (!ready || primaryNav.length === 0) {
    return [];
  }

  const visible = visibleCollectionHandles(primaryNav);
  const showOther = visible.has("other");

  return wholesaleCarouselHandles.filter((handle) => {
    if (isOtherChildHandle(handle)) {
      return showOther;
    }

    return visible.has(handle);
  });
}

export function footerLinksFromNav(
  links: YbbNavItem[] | undefined,
  fallback: Array<{ label: string; href: string }>,
  primaryNav: YbbNavItem[] = []
): Array<{ label: string; href: string }> {
  const base =
    links?.length
      ? links.map((item) => ({
          label: item.label,
          href: item.href,
        }))
      : fallback;

  return filterFooterQuickLinksByPrimaryNav(base, primaryNav);
}

/** Footer quick links for `/collections/*` follow primary nav visibility. */
export function filterFooterQuickLinksByPrimaryNav(
  links: Array<{ label: string; href: string }>,
  primaryNav: YbbNavItem[]
): Array<{ label: string; href: string }> {
  if (!primaryNav.length) {
    return links;
  }

  const visible = visibleCollectionHandles(primaryNav);

  return links.filter((link) => {
    const handle = collectionHandleFromHref(link.href);
    if (!handle) {
      return true;
    }

    return visible.has(handle);
  });
}
