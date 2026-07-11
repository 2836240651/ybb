import type { Locale } from "@/lib/i18n/locales";
import { formatInstallmentPrice, formatPrice } from "@/lib/data/products";
import type { ShopPayInstallmentsPayload } from "@/lib/site-manager/product-overrides-api";
import {
  clampInstallmentCount,
  interpolateInstallmentTemplate,
} from "@/lib/site-manager/shop-pay-installment-template";

export { interpolateInstallmentTemplate } from "@/lib/site-manager/shop-pay-installment-template";

export function resolveShopPayInstallmentText(
  payload: ShopPayInstallmentsPayload | undefined,
  locale: Locale,
  price: number,
  i18nTemplate: string
): { visible: boolean; text: string } | null {
  if (payload?.visible === false || price <= 0) {
    return null;
  }

  const count = clampInstallmentCount(payload?.installmentCount ?? 3);
  const key = locale === "zh" ? "zh" : locale === "ja" ? "ja" : "en";
  const remoteTemplate = payload?.template?.[key]?.trim() ?? "";
  const template = remoteTemplate || i18nTemplate.trim();
  if (!template) {
    return null;
  }

  const text = interpolateInstallmentTemplate(template, {
    amount: formatInstallmentPrice(price, count),
    count,
    total: formatPrice(price),
  });

  return { visible: true, text };
}
