import en from "./dictionaries/en.json";
import zh from "./dictionaries/zh.json";
import ja from "./dictionaries/ja.json";
import type { Locale } from "./locales";

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

export function translate(locale: Locale, key: string): string {
  const dict = dictionaries[locale] as Record<string, unknown>;
  return getNestedValue(dict, key) ?? getNestedValue(dictionaries.en, key) ?? key;
}
