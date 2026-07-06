"use client";

import type { ComponentProps } from "react";
import Link from "next/link";

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

  const target =
    typeof href === "string"
      ? href
      : typeof href === "object" && href && "pathname" in href
        ? `${href.pathname ?? ""}${href.search ?? ""}`
        : event.currentTarget.getAttribute("href");

  if (!target || !target.startsWith("/")) return;

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
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) {
          hardNavFallback(event, href);
        }
      }}
    />
  );
}
