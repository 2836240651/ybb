import siteBrand from "@/lib/data/site-brand.json";
import navigation from "@/lib/data/navigation.json";
import type { Locale } from "@/lib/i18n/locales";

export type SiteBrandData = {
  name: string;
  tagline: Record<Locale, string>;
  logoAlt?: string;
  logoPath?: string;
  source?: string;
  syncedAt?: string | null;
};

const FALLBACK_TAGLINE: Record<Locale, string> = {
  en: "Trusted Tackle Partner",
  zh: "值得信赖的渔具合作伙伴",
  ja: "信頼できるタックルパートナー",
};

export const siteBrandData = siteBrand as SiteBrandData;

export function getBrandName(): string {
  return siteBrandData.name?.trim() || navigation.brand.name || "YBB";
}

export function getBrandTagline(locale: Locale): string {
  const fromSync = siteBrandData.tagline?.[locale]?.trim();
  if (fromSync) return fromSync;
  const fromNav = navigation.brand.tagline?.trim();
  if (locale === "en" && fromNav) return fromNav;
  return FALLBACK_TAGLINE[locale];
}

export function getBrandLogoPath(): string {
  return siteBrandData.logoPath || "/images/brand/ybb-logo.png";
}

export function getBrandLogoAlt(): string {
  return siteBrandData.logoAlt || getBrandName();
}
