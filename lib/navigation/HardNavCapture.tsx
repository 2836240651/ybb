"use client";

import { useEffect } from "react";

function resolveInternalHref(anchor: HTMLAnchorElement): string | null {
  const href = anchor.getAttribute("href");
  if (!href || !href.startsWith("/") || anchor.target === "_blank") {
    return null;
  }
  return href;
}

function isEmptyCollectionPage(): boolean {
  if (document.querySelector('[data-collection-empty="true"]')) {
    return true;
  }
  const body = document.body?.innerText ?? "";
  return (
    body.includes("该类目暂无商品") ||
    body.includes("No products in this category yet.") ||
    body.includes("このカテゴリには商品がありません")
  );
}

/** Force full navigation when App Router soft-nav stalls on empty collection pages. */
export function HardNavCapture() {
  useEffect(() => {
    const onCaptureClick = (event: MouseEvent) => {
      if (event.defaultPrevented) return;
      if (
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey ||
        event.button !== 0
      ) {
        return;
      }
      if (!isEmptyCollectionPage()) {
        return;
      }

      const anchor = (event.target as HTMLElement | null)?.closest?.("a[href]");
      if (!anchor || !(anchor instanceof HTMLAnchorElement)) {
        return;
      }

      const target = resolveInternalHref(anchor);
      if (!target) return;

      const current = `${window.location.pathname}${window.location.search}`;
      if (target === current) return;

      event.preventDefault();
      event.stopPropagation();
      window.location.assign(target);
    };

    document.addEventListener("click", onCaptureClick, true);
    return () => document.removeEventListener("click", onCaptureClick, true);
  }, []);

  return null;
}


