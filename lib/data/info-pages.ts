import infoData from "./info-pages.json";
import type { Locale } from "@/lib/i18n/locales";
import type { PageSection } from "./content";

export type InfoPageContent = {
  title: string;
  description: string;
  sections: PageSection[];
};

const INFO_HANDLES = ["samples"] as const;

export type InfoPageHandle = (typeof INFO_HANDLES)[number];

export function isInfoPageHandle(handle: string): handle is InfoPageHandle {
  return (INFO_HANDLES as readonly string[]).includes(handle);
}

export function getInfoPage(handle: InfoPageHandle, locale: Locale): InfoPageContent {
  const entry = infoData[handle];
  return entry[locale] ?? entry.en;
}

export function getInfoPageEn(handle: InfoPageHandle): InfoPageContent {
  return infoData[handle].en;
}
