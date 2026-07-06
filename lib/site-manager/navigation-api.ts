"use client";

import { fetchYbbJson } from "@/lib/ybb-rest";
import type { MegaMenuConfig } from "@/components/layout/MegaMenu";
import type { TriLabels } from "@/lib/site-manager/labels";

export type YbbNavItem = {
  id?: string;
  label: string;
  labels?: TriLabels;
  href: string;
  enabled?: boolean;
  megaMenu?: MegaMenuConfig & {
    children: Array<{
      label: string;
      labels?: TriLabels;
      href: string;
      featuredProducts?: string[];
    }>;
    shopAll: { label: string; labels?: TriLabels; href: string };
  };
};

export type YbbNavigationResponse = {
  primaryNav: YbbNavItem[];
  footer: {
    quickLinks: YbbNavItem[];
    information: YbbNavItem[];
    policies: YbbNavItem[];
    social: Array<{ label: string; href: string }>;
  };
  syncedAt?: string;
};

export function navigationApiUrl(): string {
  return "/ybb/v1/site-manager/navigation";
}

export async function fetchNavigation(): Promise<YbbNavigationResponse | null> {
  return fetchYbbJson<YbbNavigationResponse>(navigationApiUrl());
}
