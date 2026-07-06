import policyData from "./policy-pages.json";
import type { Locale } from "@/lib/i18n/locales";
import type { PageSection } from "./content";

export type PolicyPageContent = {
  title: string;
  description: string;
  sections: PageSection[];
};

const POLICY_HANDLES = ["refund", "privacy", "shipping", "terms"] as const;

export type PolicyHandle = (typeof POLICY_HANDLES)[number];

export function isPolicyHandle(handle: string): handle is PolicyHandle {
  return (POLICY_HANDLES as readonly string[]).includes(handle);
}

export function getPolicyPage(
  handle: PolicyHandle,
  locale: Locale
): PolicyPageContent {
  const entry = policyData[handle];
  const localized = entry[locale] ?? entry.en;
  return localized;
}

export function getPolicyPageEn(handle: PolicyHandle): PolicyPageContent {
  return policyData[handle].en;
}

export const policyHandles = POLICY_HANDLES;
