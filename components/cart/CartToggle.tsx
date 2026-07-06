"use client";

import { useEffect, useState } from "react";
import { useCart } from "@/lib/store/cart";
import { cn } from "@/lib/utils";

/** OMC / Shopify theme cart: basket body, handle, and two wheels */
function CartIcon({ className }: { className?: string }) {
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
      <path d="M1 1h.5v0c.226 0 .339 0 .44.007a3 3 0 0 1 2.62 1.976c.034.095.065.204.127.42l.17.597m0 0 1.817 6.358c.475 1.664.713 2.496 1.198 3.114a4 4 0 0 0 1.633 1.231c.727.297 1.592.297 3.322.297h2.285c1.75 0 2.626 0 3.359-.302a4 4 0 0 0 1.64-1.253c.484-.627.715-1.472 1.175-3.161l.06-.221c.563-2.061.844-3.092.605-3.906a3 3 0 0 0-1.308-1.713C19.92 4 18.853 4 16.716 4H4.857ZM12 20a2 2 0 1 1-4 0 2 2 0 0 1 4 0Zm8 0a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z" />
    </svg>
  );
}

export function CartToggle({
  iconOnly = false,
  className,
}: {
  iconOnly?: boolean;
  className?: string;
}) {
  const { open, itemCount } = useCart();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const count = mounted ? itemCount() : 0;

  return (
    <button
      type="button"
      onClick={open}
      className={cn(
        "inline-flex touch-target items-center justify-center gap-1.5",
        iconOnly ? "interaction-icon-hover header-utility-icon header-utility-icon--cart" : "interaction-nav-link",
        className
      )}
      aria-label={count > 0 ? `Cart, ${count} items` : "Open cart"}
    >
      <span className="relative inline-flex shrink-0">
        <CartIcon className="h-5 w-5" />
        {count > 0 && (
          <span
            className="absolute top-0 right-0 flex h-[18px] min-w-[18px] translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-foreground px-1 text-[11px] font-semibold leading-none tabular-nums text-background ring-2 ring-background"
            aria-hidden
          >
            {count > 99 ? "99+" : count}
          </span>
        )}
      </span>
      {!iconOnly && <span>Cart</span>}
    </button>
  );
}
