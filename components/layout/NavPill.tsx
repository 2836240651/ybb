"use client";

import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { hardNavFallback } from "@/lib/navigation/hard-nav-fallback";
import { cn } from "@/lib/utils";

type NavPillBaseProps = {
  children: ReactNode;
  className?: string;
  active?: boolean;
};

type NavPillLinkProps = NavPillBaseProps &
  Omit<ComponentProps<typeof Link>, "className" | "children">;

type NavPillButtonProps = NavPillBaseProps &
  Omit<ComponentProps<"button">, "className" | "children">;

function NavPillInner({
  children,
  className,
  active,
}: NavPillBaseProps) {
  return (
    <span className={cn("nav-pill", active && "nav-pill--active", className)}>
      <span className="nav-pill__text">{children}</span>
      <span className="nav-pill__duplicate" aria-hidden>
        {children}
      </span>
    </span>
  );
}

export function NavPillLink({
  children,
  className,
  active,
  href,
  onClick,
  ...props
}: NavPillLinkProps) {
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
      className="nav-pill-trigger inline-flex"
    >
      <NavPillInner className={className} active={active}>
        {children}
      </NavPillInner>
    </Link>
  );
}

export function NavPillButton({
  children,
  className,
  active,
  type = "button",
  ...props
}: NavPillButtonProps) {
  return (
    <button type={type} {...props} className="nav-pill-trigger inline-flex">
      <NavPillInner className={className} active={active}>
        {children}
      </NavPillInner>
    </button>
  );
}
