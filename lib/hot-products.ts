"use client";

import { ybbRestUrl } from "@/lib/ybb-rest";

export type HotProductItem = {
  handle: string;
  title: string;
  price: number;
  compareAtPrice?: number | null;
  image: string;
  href: string;
  available: boolean;
};

export type HotProductsResponse = {
  enabled: boolean;
  autoplayMs: number;
  products: HotProductItem[];
  syncedAt?: string;
};

function restUrl(route: string): string {
  return ybbRestUrl(route);
}

export function hotProductsApiUrl(): string {
  return restUrl("/ybb/v1/hot-products");
}

export function hotProductsHydrateScriptUrl(): string {
  return restUrl("/ybb/v1/hot-products-hydrate.js");
}

export async function fetchHotProducts(): Promise<HotProductsResponse | null> {
  try {
    const res = await fetch(hotProductsApiUrl(), {
      credentials: "same-origin",
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as HotProductsResponse;
    if (!data.enabled || !Array.isArray(data.products) || data.products.length === 0) {
      return null;
    }
    return data;
  } catch {
    return null;
  }
}
