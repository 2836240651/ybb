import type { ProductContentPayload } from "@/lib/site-manager/product-overrides-api";
import type { Locale } from "@/lib/i18n/locales";

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}

export type ResolvedProductContent = {
  descriptionHtml: string;
  descriptionVisible: boolean;
  additionalVisible: boolean;
  rows: ProductContentPayload["additionalInfo"]["rows"];
};

export function pickProductContentForLocale(
  content: ProductContentPayload,
  locale: Locale
): ResolvedProductContent {
  const html =
    content.description.html[locale] || content.description.html.en || "";
  const descriptionVisible =
    content.description.visible && stripHtml(html) !== "";
  const additionalVisible =
    content.additionalInfo.visible && content.additionalInfo.rows.length > 0;

  return {
    descriptionHtml: html,
    descriptionVisible,
    additionalVisible,
    rows: content.additionalInfo.rows,
  };
}
