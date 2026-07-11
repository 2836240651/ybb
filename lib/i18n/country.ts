export const COUNTRY_STORAGE_KEY = "ybb-country";

export const COUNTRY_OPTIONS = [
  { id: "global", flag: "🌐", label: "Global", currency: "USD", symbol: "$" },
  { id: "uk", flag: "🇬🇧", label: "United Kingdom", currency: "GBP", symbol: "£" },
  { id: "eu", flag: "🇪🇺", label: "European Union", currency: "EUR", symbol: "€" },
] as const;

export type CountryOption = (typeof COUNTRY_OPTIONS)[number];

export function readStoredCountry(): CountryOption {
  if (typeof window === "undefined") return COUNTRY_OPTIONS[0];
  const stored = localStorage.getItem(COUNTRY_STORAGE_KEY);
  return COUNTRY_OPTIONS.find((o) => o.id === stored) ?? COUNTRY_OPTIONS[0];
}

export function storeCountry(id: CountryOption["id"]) {
  localStorage.setItem(COUNTRY_STORAGE_KEY, id);
}


