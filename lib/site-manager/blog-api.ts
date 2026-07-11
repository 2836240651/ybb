"use client";

import { useEffect, useState } from "react";
import { fetchYbbJson } from "@/lib/ybb-rest";

export type BlogContentBlockBase = { id: string; enabled?: boolean; sortOrder?: number };

export type BlogContentBlock =
  | (BlogContentBlockBase & { type: "paragraph"; text: string })
  | (BlogContentBlockBase & {
      type: "heading";
      text: string;
      level?: "h2" | "h3";
    })
  | (BlogContentBlockBase & {
      type: "quote";
      text: string;
      caption?: string;
    })
  | (BlogContentBlockBase & {
      type: "image";
      imageUrl: string;
      alt?: string;
      caption?: string;
      width?: "prose" | "wide";
    })
  | (BlogContentBlockBase & {
      type: "mediaText";
      imageUrl?: string;
      alt?: string;
      eyebrow?: string;
      title?: string;
      text?: string;
      imageSide?: "left" | "right";
    })
  | (BlogContentBlockBase & {
      type: "checklist";
      title?: string;
      items?: string[];
    })
  | (BlogContentBlockBase & {
      type: "cta";
      title?: string;
      text?: string;
      buttonLabel?: string;
      href?: string;
    });

export type BlogArticleApi = {
  id: string;
  handle: string;
  title: string;
  excerpt: string;
  publishedAt: string;
  imageUrl: string;
  author: string;
  content: string[];
  contentBlocks?: BlogContentBlock[];
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
  if (raw.startsWith("https://")) return raw;
  if (raw.startsWith("http://")) return `https://${raw.slice(7)}`;
  return raw.startsWith("/") ? raw : `/${raw}`;
}
