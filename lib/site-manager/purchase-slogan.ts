import type { Locale } from "@/lib/i18n/locales";
import type { PurchaseSloganPayload } from "@/lib/site-manager/product-overrides-api";

export function resolvePurchaseSlogan(
  payload: PurchaseSloganPayload | undefined,
  locale: Locale,
  i18nFallback: string,
  liveReady = true
): { visible: boolean; text: string } {
  if (!liveReady) {
    return { visible: false, text: "" };
  }

  if (payload?.visible === false) {
    return { visible: false, text: "" };
  }

  const key = locale === "zh" ? "zh" : locale === "ja" ? "ja" : "en";
  const remote = payload?.text?.[key]?.trim() ?? "";
  const text = remote || i18nFallback.trim();

  if (!text) {
    return { visible: false, text: "" };
  }

  return { visible: true, text };
}
