"use client";

import type { ComponentProps } from "react";
import Link from "next/link";

/** Static export routes that must use full document navigation (avoid RSC .txt soft-nav). */
const STATIC_HARD_NAV_PREFIXES = /^\/(collections|products|pages|blogs)(\/|$)/;

function resolveLinkTarget(
  href: ComponentProps<typeof Link>["href"],
  anchor: HTMLAnchorElement
): string | null {
  const target =
    typeof href === "string"
      ? href
      : typeof href === "object" && href && "pathname" in href
        ? `${href.pathname ?? ""}${href.search ?? ""}`
        : anchor.getAttribute("href");

  if (!target || !target.startsWith("/")) return null;
  return target;
}

function shouldForceHardNav(path: string): boolean {
  const pathname = path.split("?")[0]?.split("#")[0] ?? path;
  return STATIC_HARD_NAV_PREFIXES.test(pathname);
}

/** When App Router soft-nav stalls, fall back to a full document navigation. */
export function hardNavFallback(
  event: React.MouseEvent<HTMLAnchorElement>,
  href: ComponentProps<typeof Link>["href"]
) {
  if (
    event.defaultPrevented ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey ||
    event.button !== 0
  ) {
    return;
  }

  const target = resolveLinkTarget(href, event.currentTarget);
  if (!target) return;

  if (shouldForceHardNav(target)) {
    event.preventDefault();
    window.location.assign(target);
    return;
  }

  const start = `${window.location.pathname}${window.location.search}`;
  window.setTimeout(() => {
    const now = `${window.location.pathname}${window.location.search}`;
    if (now === start) {
      window.location.assign(target);
    }
  }, 400);
}

export function HardNavLink({
  href,
  onClick,
  ...props
}: ComponentProps<typeof Link>) {
  return (
    <Link
      {...props}
      href={href}
      prefetch={false}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) {
          hardNavFallback(event, href);
        }
      }}
    />
  );
}
