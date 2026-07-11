"use client";

import Link from "next/link";
import { useMemo } from "react";
import {
  BlogContentBlocks,
  articleHeroDuplicatesFirstMediaBlock,
} from "@/components/blog/BlogContentBlocks";
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

function blogArticleToApi(
  article: BlogArticle,
  blogHandle: string
): BlogArticleApi {
  return {
    id: article.handle,
    handle: article.handle,
    title: article.title,
    excerpt: article.excerpt,
    publishedAt: article.publishedAt,
    imageUrl: article.image,
    author: article.author,
    content: article.content,
    href: `/blogs/${blogHandle}/${article.handle}`,
  };
}

function blogToResponse(source: Blog): BlogResponse {
  return {
    enabled: true,
    handle: source.handle,
    title: source.title,
    description: source.description,
    latestStoriesEnabled: true,
    articles: source.articles.map((article) =>
      blogArticleToApi(article, source.handle)
    ),
  };
}

function formatDate(iso: string) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function BlogArticleView({
  blogHandle,
  articleHandle,
  fallbackBlog,
  fallbackArticle,
}: Props) {
  const staticFallback = useMemo(
    () => blogToResponse(fallbackBlog),
    [fallbackBlog]
  );
  const staticArticle = useMemo(
    () => blogArticleToApi(fallbackArticle, blogHandle),
    [fallbackArticle, blogHandle]
  );

  const { data, ready } = useYbbBlog(staticFallback);

  const blogTitle = data?.title ?? fallbackBlog.title;
  const blogListHandle = data?.handle ?? fallbackBlog.handle;
  const article =
    data?.articles.find((entry) => entry.handle === articleHandle) ??
    staticArticle;
  const imageSrc = blogArticleImageSrc(article);
  const showHero =
    Boolean(imageSrc) && !articleHeroDuplicatesFirstMediaBlock(article);
  const isUnavailable = ready && !article.title;

  return (
    <article
      className="page-container py-12 md:py-16 lg:py-20"
      data-ybb-blog-ready={ready ? "1" : undefined}
      aria-busy={!ready}
    >
      <div className="mx-auto max-w-3xl">
        <Link
          href={`/blogs/${blogListHandle}`}
          className="mb-8 inline-block text-sm text-foreground/50 transition-colors hover:text-foreground"
        >
          Back to {blogTitle}
        </Link>

        <header className="mb-8 md:mb-10">
          {article.publishedAt ? (
            <time
              dateTime={article.publishedAt}
              className="text-sm text-foreground/50"
            >
              {formatDate(article.publishedAt)}
            </time>
          ) : null}
          <h1 className="text-title-md mt-2 mb-4 text-balance">
            {article.title || fallbackArticle.title}
          </h1>
          {article.author ? (
            <p className="text-sm text-foreground/50">By {article.author}</p>
          ) : null}
          {isUnavailable ? (
            <Link
              href={`/blogs/${blogHandle}/${fallbackArticle.handle}`}
              className="mt-3 inline-block text-sm font-medium underline-offset-4 hover:underline"
            >
              Retry this story
            </Link>
          ) : null}
        </header>
      </div>

      {showHero ? (
        <div className="relative mx-auto mb-10 aspect-[21/9] max-w-5xl overflow-hidden rounded-card bg-neutral-100 md:mb-12">
          <img
            src={imageSrc}
            alt={article.title}
            className="h-full w-full object-cover"
            loading="eager"
            decoding="async"
          />
        </div>
      ) : null}

      <BlogContentBlocks article={article} />
    </article>
  );
}
