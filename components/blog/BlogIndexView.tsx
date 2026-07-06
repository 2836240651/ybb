"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo } from "react";
import type { Blog } from "@/lib/data/content";
import {
  blogArticleImageSrc,
  useYbbBlog,
  type BlogResponse,
} from "@/lib/site-manager/blog-api";

type Props = {
  blogHandle: string;
  fallback: Blog;
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function fallbackToResponse(fallback: Blog): BlogResponse {
  return {
    enabled: true,
    handle: fallback.handle,
    title: fallback.title,
    description: fallback.description,
    latestStoriesEnabled: true,
    articles: fallback.articles.map((article) => ({
      id: `article-${article.handle}`,
      handle: article.handle,
      title: article.title,
      excerpt: article.excerpt,
      publishedAt: article.publishedAt,
      imageUrl: article.image,
      author: article.author,
      content: article.content,
      href: `/blogs/${fallback.handle}/${article.handle}`,
    })),
  };
}

export function BlogIndexView({ blogHandle, fallback }: Props) {
  const fallbackResponse = useMemo(() => fallbackToResponse(fallback), [fallback]);
  const { data, ready } = useYbbBlog(fallbackResponse);

  if (!data || data.handle !== blogHandle) {
    return (
      <div className="page-container py-16">
        <h1 className="text-title-md mb-4">Blog not found</h1>
      </div>
    );
  }

  const articles = data.articles;

  return (
    <div
      className="page-container py-12 md:py-16 lg:py-20"
      data-ybb-blog-ready={ready ? "1" : undefined}
      aria-busy={!ready}
    >
      <header className="max-w-3xl mb-10 md:mb-12">
        <p className="text-sm uppercase tracking-widest text-foreground/50 mb-2">
          Insights
        </p>
        <h1 className="text-[32px] lg:text-title-md leading-none mb-4">
          {data.title}
        </h1>
        <p className="text-foreground/60 leading-relaxed">{data.description}</p>
      </header>

      <ul className="blog-grid grid gap-x-[18px] gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
        {articles.map((article) => {
          const imageSrc = blogArticleImageSrc(article);
          return (
            <li key={article.handle}>
              <article className="group flex flex-col h-full rounded-card border border-border overflow-hidden hover:shadow-lg transition-shadow">
                <Link
                  href={`/blogs/${blogHandle}/${article.handle}`}
                  className="flex flex-col flex-1"
                >
                  <div className="relative aspect-[16/10] bg-neutral-100 overflow-hidden">
                    {imageSrc ? (
                      <Image
                        src={imageSrc}
                        alt={article.title}
                        fill
                        sizes="(max-width: 768px) 100vw, 33vw"
                        className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                      />
                    ) : null}
                  </div>
                  <div className="flex flex-col flex-1 p-5 md:p-6 gap-2.5">
                    <time
                      dateTime={article.publishedAt}
                      className="text-xs text-foreground/50"
                    >
                      {formatDate(article.publishedAt)}
                    </time>
                    <h2 className="text-lg font-bold line-clamp-2 group-hover:opacity-80 transition-opacity">
                      {article.title}
                    </h2>
                    <p className="text-sm text-foreground/60 line-clamp-3 flex-1">
                      {article.excerpt}
                    </p>
                    <span className="text-sm font-medium mt-2">Read more �?/span>
                  </div>
                </Link>
              </article>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
