"use client";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://carp-ybb.com";

export type LatestStoryArticle = {
  handle: string;
  title: string;
  excerpt: string;
  publishedAt: string;
  image: string;
  href: string;
};

export type LatestStoriesResponse = {
  enabled: boolean;
  articles: LatestStoryArticle[];
  syncedAt?: string;
};

function restUrl(route: string): string {
  const base = `${SITE.replace(/\/$/, "")}/index.php`;
  return `${base}?${new URLSearchParams({
    rest_route: route,
    _: String(Date.now()),
  }).toString()}`;
}

export function latestStoriesApiUrl(): string {
  return restUrl("/ybb/v1/latest-stories");
}

export function latestStoriesHydrateScriptUrl(): string {
  return restUrl("/ybb/v1/latest-stories-hydrate.js");
}

export async function fetchLatestStories(): Promise<LatestStoriesResponse | null> {
  try {
    const res = await fetch(latestStoriesApiUrl(), {
      credentials: "same-origin",
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as LatestStoriesResponse;
    if (!data.enabled || !Array.isArray(data.articles) || data.articles.length === 0) {
      return null;
    }
    return data;
  } catch {
    return null;
  }
}
