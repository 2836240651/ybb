"use client";

import {
  wooAccountLoginUrl,
  wooAccountRegisterUrl,
} from "@/lib/woocommerce/auth";

const CHECKOUT_URL =
  `${process.env.NEXT_PUBLIC_SITE_URL || "https://carp-ybb.com"}`.replace(
    /\/$/,
    ""
  ) + "/checkout/";

type Props = {
  hint: string;
  signInLabel: string;
  registerLabel: string;
  className?: string;
};

export function CartCheckoutAuthLinks({
  hint,
  signInLabel,
  registerLabel,
  className = "",
}: Props) {
  const loginUrl = wooAccountLoginUrl(CHECKOUT_URL);
  const registerUrl = wooAccountRegisterUrl(CHECKOUT_URL);

  return (
    <p className={`text-xs text-foreground/55 ${className}`.trim()}>
      {hint}{" "}
      <a
        href={loginUrl}
        className="underline underline-offset-2 hover:opacity-80"
      >
        {signInLabel}
      </a>
      <span aria-hidden="true"> · </span>
      <a
        href={registerUrl}
        className="underline underline-offset-2 hover:opacity-80"
      >
        {registerLabel}
      </a>
    </p>
  );
}
