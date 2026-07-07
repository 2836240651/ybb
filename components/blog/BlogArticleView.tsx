"use client";

import Image from "next/image";
import Link from "next/link";
import { BlogContentBlocks } from "@/components/blog/BlogContentBlocks";
import type { Blog, BlogArticle } from "@/lib/data/content";
import {
  blogArticleImageSrc,
  useYbbBlog,
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

export function BlogArticleView({
  blogHandle,
  articleHandle,
  fallbackBlog,
  fallbackArticle,
}: Props) {
  const { data, ready } = useYbbBlog(null);

  const blogTitle = data?.title ?? fallbackBlog.title;
  const blogListHandle = data?.handle ?? fallbackBlog.handle;
  const article = data?.articles.find((a) => a.handle === articleHandle);
  const imageSrc = article ? blogArticleImageSrc(article) : "";
  const isUnavailable = ready && !article;
  const fallbackHref = `/blogs/${blogHandle}/${fallbackArticle.handle}`;

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
        {article ? (
          <>
            <time
              dateTime={article.publishedAt}
              className="text-sm text-foreground/50"
            >
              {formatDate(article.publishedAt)}
            </time>
            <h1 className="text-title-md mt-2 mb-4">{article.title}</h1>
            <p className="text-sm text-foreground/50">By {article.author}</p>
          </>
        ) : (
          <>
            <p className="text-sm text-foreground/50">
              {ready ? "Article unavailable" : "Loading article"}
            </p>
            <h1 className="text-title-md mt-2 mb-4">
              {ready ? fallbackArticle.title : "News & Insights"}
            </h1>
            {isUnavailable ? (
              <Link
                href={fallbackHref}
                className="text-sm font-medium underline-offset-4 hover:underline"
              >
                Retry this story
              </Link>
            ) : null}
          </>
        )}
      </header>

      {article && imageSrc ? (
        <div className="relative aspect-[21/9] max-w-4xl mb-12 rounded-card overflow-hidden bg-neutral-100">
          <Image
            src={imageSrc}
            alt={article.title}
            fill
            sizes="(max-width: 1024px) 100vw, 896px"
            className="object-cover"
            priority
          />
        </div>
      ) : null}

      {article ? (
        <BlogContentBlocks article={article} />
      ) : (
        <div className="max-w-prose space-y-5 text-foreground/75 leading-relaxed">
          <p>
            {ready
              ? "This story is managed in YBB Site Manager and is temporarily unavailable."
              : "Fetching the latest story from YBB Site Manager."}
          </p>
        </div>
      )}
    </article>
  );
}
