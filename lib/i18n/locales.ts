export const LOCALE_STORAGE_KEY = "ybb-locale";

export type Locale = "zh" | "en" | "ja";

export const DEFAULT_LOCALE: Locale = "en";

export const LOCALES: Locale[] = ["zh", "en", "ja"];

export const localeHtmlLang: Record<Locale, string> = {
  zh: "zh-CN",
  en: "en",
  ja: "ja",
};

export const localeLabels: Record<Locale, string> = {
  zh: "简体中�?,
  en: "English",
  ja: "日本�?,
};

export const localeShortLabels: Record<Locale, string> = {
  zh: "中文",
  en: "English",
  ja: "日本�?,
};
