import type { Locale } from "@/lib/i18n/locales";

export type TriLabels = {
  en?: string;
  zh?: string;
  ja?: string;
};

export function resolveTriLabel(
  labels: TriLabels | undefined,
  locale: Locale,
  fallback: string
): string {
  if (labels?.[locale]?.trim()) return labels[locale]!.trim();
  if (labels?.en?.trim()) return labels.en.trim();
  return fallback;
}

export function resolveNavLabel(
  item: { label: string; labels?: TriLabels },
  locale: Locale,
  tl: (label: string) => string
): string {
  const fromRest = resolveTriLabel(item.labels, locale, "");
  if (fromRest) return fromRest;
  return tl(item.label);
}
