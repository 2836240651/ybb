import dictionary from "@/lib/data/variant-spec-i18n.json";
import type { ProductVariant } from "@/lib/types/product";
import type { Locale } from "@/lib/i18n/locales";

type SpecDict = Record<string, { en: string; zh: string; ja: string }>;

const SPEC_DICT = dictionary as SpecDict;

const HAN_RE = /[\u4e00-\u9fff]/;

function isAsciiSpec(text: string): boolean {
  return Boolean(text) && !HAN_RE.test(text);
}

/** Build specEn/specZh/specJa on a variant (canonical `spec` unchanged). */
export function enrichVariantSpecI18n(
  variant: ProductVariant,
  catalogSpec?: string
): ProductVariant {
  const spec = String(variant.spec || catalogSpec || "").trim() || "Default";
  const dict = SPEC_DICT[spec];
  if (dict) {
    return { ...variant, spec, specEn: dict.en, specZh: dict.zh, specJa: dict.ja };
  }
  if (isAsciiSpec(spec)) {
    return { ...variant, spec, specEn: spec, specZh: spec, specJa: spec };
  }
  return {
    ...variant,
    spec,
    specZh: spec,
    specEn: spec,
    specJa: spec,
  };
}

export function getLocalizedVariantSpec(
  variant: ProductVariant,
  locale: Locale
): string {
  if (locale === "zh") return variant.specZh || variant.spec;
  if (locale === "ja") return variant.specJa || variant.specEn || variant.spec;
  return variant.specEn || variant.spec;
}

export function getDisplaySku(
  parentSku: string | undefined,
  variant: ProductVariant | undefined,
  locale: Locale
): string | undefined {
  if (!variant?.sku) return parentSku;
  if (locale === "zh") return variant.sku;
  return parentSku || variant.sku;
}
