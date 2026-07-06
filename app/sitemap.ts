import type { MetadataRoute } from "next";
import { blog, pages } from "@/lib/data/content";
import { collections, products } from "@/lib/data/products";
import { absoluteUrl } from "@/lib/seo";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const staticEntries: MetadataRoute.Sitemap = [
    { url: absoluteUrl("/"), lastModified: now, changeFrequency: "weekly", priority: 1 },
    {
      url: absoluteUrl("/collections"),
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: absoluteUrl("/pages/contact"),
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: absoluteUrl(`/blogs/${blog.handle}`),
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.6,
    },
  ];

  const collectionEntries = collections.map((c) => ({
    url: absoluteUrl(`/collections/${c.handle}`),
    lastModified: now,
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));

  const productEntries = products.map((p) => ({
    url: absoluteUrl(`/products/${p.handle}`),
    lastModified: now,
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));

  const pageEntries = pages.map((p) => ({
    url: absoluteUrl(`/pages/${p.handle}`),
    lastModified: now,
    changeFrequency: "monthly" as const,
    priority: 0.5,
  }));

  const articleEntries = blog.articles.map((a) => ({
    url: absoluteUrl(`/blogs/${blog.handle}/${a.handle}`),
    lastModified: new Date(a.publishedAt),
    changeFrequency: "monthly" as const,
    priority: 0.5,
  }));

  return [
    ...staticEntries,
    ...collectionEntries,
    ...productEntries,
    ...pageEntries,
    ...articleEntries,
  ];
}
