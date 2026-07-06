"use client";

import { useEffect } from "react";
import { useI18n } from "@/lib/i18n/I18nProvider";
import {
  wooAccountLoginUrl,
  wooAccountRegisterUrl,
} from "@/lib/woocommerce/auth";

const SITE = (process.env.NEXT_PUBLIC_SITE_URL || "https://carp-ybb.com").replace(
  /\/$/,
  ""
);

export default function AccountPage() {
  const { t } = useI18n();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const redirectTo = params.get("redirect_to");
    const target = new URL("/my-account/", SITE);

    if (redirectTo) {
      target.searchParams.set("redirect_to", redirectTo);
    } else {
      target.searchParams.set(
        "redirect_to",
        `${SITE}/checkout/`
      );
    }

    if (params.get("action") === "register") {
      target.searchParams.set("action", "register");
    }

    window.location.replace(target.toString());
  }, []);

  const checkoutUrl = `${SITE}/checkout/`;

  return (
    <div className="page-container py-16">
      <h1 className="text-[21px] font-medium leading-[1.38] mb-4">
        {t("account.title")}
      </h1>
      <p className="opacity-70 mb-6 max-w-prose">{t("account.redirecting")}</p>
      <p className="text-sm opacity-60">
        <a
          href={wooAccountLoginUrl(checkoutUrl)}
          className="underline underline-offset-2"
        >
          {t("account.signIn")}
        </a>
        <span aria-hidden="true"> · </span>
        <a
          href={wooAccountRegisterUrl(checkoutUrl)}
          className="underline underline-offset-2"
        >
          {t("account.register")}
        </a>
      </p>
    </div>
  );
}
