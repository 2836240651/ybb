"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo } from "react";
import type { Blog, BlogArticle } from "@/lib/data/content";
import {
  blogArticleImageSrc,
  useYbbBlog,
  type BlogArticleApi,
  type BlogResponse,
} from "@/lib/site-manager/blog-api";

type Props = {
  blogHandle: string;
  articleHandle: string;
  fallbackBlog: Blog;
  fallbackArticle: BlogArticle;
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

function toDisplayArticle(
  remote: BlogArticleApi | undefined,
  fallback: BlogArticle,
  blogHandle: string
): BlogArticleApi {
  if (!remote) {
    return {
      id: `article-${fallback.handle}`,
      handle: fallback.handle,
      title: fallback.title,
      excerpt: fallback.excerpt,
      publishedAt: fallback.publishedAt,
      imageUrl: fallback.image,
      author: fallback.author,
      content: fallback.content,
      href: `/blogs/${blogHandle}/${fallback.handle}`,
    };
  }
  return remote;
}

export function BlogArticleView({
  blogHandle,
  articleHandle,
  fallbackBlog,
  fallbackArticle,
}: Props) {
  const fallbackResponse = useMemo(
    () => fallbackToResponse(fallbackBlog),
    [fallbackBlog]
  );
  const { data, ready } = useYbbBlog(fallbackResponse);

  const blogTitle = data?.title ?? fallbackBlog.title;
  const blogListHandle = data?.handle ?? fallbackBlog.handle;
  const remoteArticle = data?.articles.find((a) => a.handle === articleHandle);
  const article = toDisplayArticle(remoteArticle, fallbackArticle, blogHandle);
  const imageSrc = blogArticleImageSrc(article);

  return (
    <article
      className="page-container py-16"
      data-ybb-blog-ready={ready ? "1" : undefined}
      aria-busy={!ready}
    >
      <Link
        href={`/blogs/${blogListHandle}`}
        className="text-sm text-foreground/50 hover:text-foreground mb-8 inline-block"
      >
        �?Back to {blogTitle}
      </Link>

      <header className="max-w-3xl mb-10">
        <time
          dateTime={article.publishedAt}
          className="text-sm text-foreground/50"
        >
          {formatDate(article.publishedAt)}
        </time>
        <h1 className="text-title-md mt-2 mb-4">{article.title}</h1>
        <p className="text-sm text-foreground/50">By {article.author}</p>
      </header>

      <div className="relative aspect-[21/9] max-w-4xl mb-12 rounded-card overflow-hidden bg-neutral-100">
        {imageSrc ? (
          <Image
            src={imageSrc}
            alt={article.title}
            fill
            sizes="(max-width: 1024px) 100vw, 896px"
            className="object-cover"
            priority
          />
        ) : null}
      </div>

      <div className="max-w-prose space-y-5 text-foreground/75 leading-relaxed">
        {article.content.map((para) => (
          <p key={para.slice(0, 48)}>{para}</p>
        ))}
      </div>
    </article>
  );
}
