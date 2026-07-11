import type { Locale } from "@/lib/i18n/locales";
import type { PdpTabLabelsPayload } from "@/lib/site-manager/product-overrides-api";

export const DEFAULT_PDP_TAB_LABELS: PdpTabLabelsPayload = {
  description: {
    en: "Description",
    zh: "商品描述",
    ja: "商品説明",
  },
  additionalInfo: {
    en: "Additional information",
    zh: "附加信息",
    ja: "追加情報",
  },
  reviews: {
    en: "Reviews ({count})",
    zh: "评价 ({count})",
    ja: "レビュー ({count})",
  },
  reviewsBadge: {
    en: "{rating} · {count} reviews",
    zh: "{rating} · {count} 条评价",
    ja: "{rating} · {count} 件のレビュー",
  },
  reviewsBadgeNoRating: {
    en: "{count} reviews",
    zh: "{count} 条评价",
    ja: "{count} 件のレビュー",
  },
  writeFirstReview: {
    en: "Write the first review",
    zh: "撰写首条评价",
    ja: "最初のレビューを書く",
  },
  contentTabsLabel: {
    en: "Product details",
    zh: "商品详情",
    ja: "商品詳細",
  },
};

function localeKey(locale: Locale): "en" | "zh" | "ja" {
  return locale === "zh" ? "zh" : locale === "ja" ? "ja" : "en";
}

export function interpolatePdpLabel(
  template: string,
  params?: Record<string, string | number>
): string {
  if (!params) return template;
  return Object.entries(params).reduce(
    (text, [key, value]) => text.replaceAll(`{${key}}`, String(value)),
    template
  );
}

export function pickPdpTabLabel(
  payload: PdpTabLabelsPayload | undefined | null,
  key: keyof PdpTabLabelsPayload,
  locale: Locale,
  params?: Record<string, string | number>
): string {
  const lang = localeKey(locale);
  const remote = payload?.[key]?.[lang]?.trim();
  const fallback = DEFAULT_PDP_TAB_LABELS[key][lang];
  return interpolatePdpLabel(remote || fallback, params);
}

export function pickPdpTabLabelsForLocale(
  payload: PdpTabLabelsPayload | undefined | null,
  locale: Locale
): Record<keyof PdpTabLabelsPayload, string> {
  const keys = Object.keys(DEFAULT_PDP_TAB_LABELS) as Array<keyof PdpTabLabelsPayload>;
  return Object.fromEntries(
    keys.map((key) => [key, pickPdpTabLabel(payload, key, locale)])
  ) as Record<keyof PdpTabLabelsPayload, string>;
}
