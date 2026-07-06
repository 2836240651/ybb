"use client";

import { useEffect, useState } from "react";
import { fetchYbbJson } from "@/lib/ybb-rest";

export type BlogArticleApi = {
  id: string;
  handle: string;
  title: string;
  excerpt: string;
  publishedAt: string;
  imageUrl: string;
  author: string;
  content: string[];
  featuredOnHome?: boolean;
  href: string;
};

export type BlogResponse = {
  enabled: boolean;
  handle: string;
  title: string;
  description: string;
  latestStoriesEnabled: boolean;
  articles: BlogArticleApi[];
  syncedAt?: string;
};

export async function fetchBlog(): Promise<BlogResponse | null> {
  return fetchYbbJson<BlogResponse>("/ybb/v1/site-manager/blog");
}

export function useYbbBlog(fallback: BlogResponse | null) {
  const [data, setData] = useState<BlogResponse | null>(fallback);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetchBlog().then((remote) => {
      if (cancelled) return;
      if (remote?.enabled && remote.articles?.length) {
        setData(remote);
      } else if (fallback) {
        setData(fallback);
      }
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [fallback]);

  return { data, ready };
}

export function blogArticleImageSrc(article: { imageUrl?: string; image?: string }): string {
  const raw = article.imageUrl || article.image || "";
  if (!raw) return "";
  if (raw.startsWith("http://")) return `https://${raw.slice(7)}`;
  return raw.startsWith("/") ? raw : `/${raw}`;
}
