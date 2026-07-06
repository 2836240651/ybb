"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { getCollectionByHandle } from "@/lib/data/products";
import { labelDictKey } from "./label-keys";
import en from "./dictionaries/en.json";
import zh from "./dictionaries/zh.json";
import ja from "./dictionaries/ja.json";
import {
  DEFAULT_LOCALE,
  LOCALE_STORAGE_KEY,
  localeHtmlLang,
  localeShortLabels,
  type Locale,
} from "./locales";

const dictionaries = { en, zh, ja } as const;

function getNestedValue(
  obj: Record<string, unknown>,
  path: string
): string | undefined {
  const parts = path.split(".");
  let current: unknown = obj;
  for (const part of parts) {
    if (current && typeof current === "object" && part in current) {
      current = (current as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }
  return typeof current === "string" ? current : undefined;
}

function interpolate(
  template: string,
  params?: Record<string, string | number>
): string {
  if (!params) return template;
  return Object.entries(params).reduce(
    (text, [key, value]) => text.replaceAll(`{${key}}`, String(value)),
    template
  );
}

type I18nContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
  tl: (label: string) => string;
  localeLabel: string;
  ready: boolean;
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
    if (stored === "zh" || stored === "en" || stored === "ja") {
      setLocaleState(stored);
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    document.documentElement.lang = localeHtmlLang[locale];
    localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  }, [locale, ready]);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
  }, []);

  const dict = dictionaries[locale];

  const t = useCallback(
    (key: string, params?: Record<string, string | number>) => {
      const value =
        getNestedValue(dict as Record<string, unknown>, key) ??
        getNestedValue(en as Record<string, unknown>, key) ??
        key;
      return interpolate(value, params);
    },
    [dict]
  );

  const tl = useCallback(
    (label: string) => {
      const key = labelDictKey(label);
      const value = t(key);
      return value === key ? label : value;
    },
    [t]
  );

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      setLocale,
      t,
      tl,
      localeLabel: localeShortLabels[locale],
      ready,
    }),
    [locale, setLocale, t, tl, ready]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error("useI18n must be used within I18nProvider");
  }
  return ctx;
}

export function useProductTitle(product: {
  title: string;
  titleEn?: string;
  titleZh?: string;
  titleJa?: string;
  titleCn?: string;
}): string {
  const { locale } = useI18n();
  const titleEn = product.titleEn || product.title;
  const titleZh = product.titleZh || product.titleCn || titleEn;
  const titleJa = product.titleJa || titleEn;
  if (locale === "zh") return titleZh;
  if (locale === "ja") return titleJa;
  return titleEn;
}

export function useCollectionTitle(
  handle: string,
  fallback: string
): string {
  const { locale, t } = useI18n();
  if (locale === "zh") {
    const collection = getCollectionByHandle(handle);
    return collection?.titleCn || fallback;
  }
  if (locale === "ja") {
    const key = `collections.${handle}`;
    const translated = t(key);
    return translated !== key ? translated : fallback;
  }
  return fallback;
}
