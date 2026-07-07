"use client";

import Image from "next/image";
import Link from "next/link";
import type {
  BlogArticleApi,
  BlogContentBlock,
} from "@/lib/site-manager/blog-api";
import { blogArticleImageSrc } from "@/lib/site-manager/blog-api";
import { cn } from "@/lib/utils";

type ArticleBody = Pick<
  BlogArticleApi,
  "title" | "content" | "contentBlocks"
>;

function enabledBlocks(
  blocks: BlogContentBlock[] | undefined
): BlogContentBlock[] {
  return (blocks ?? []).filter((block) => block.enabled !== false);
}

function blockImageSrc(src?: string): string {
  return blogArticleImageSrc({ imageUrl: src ?? "" });
}

function legacyParagraphs(article: ArticleBody) {
  return (
    <div className="mx-auto max-w-prose space-y-5 text-foreground/75 leading-relaxed">
      {article.content.map((para) => (
        <p key={para.slice(0, 48)}>{para}</p>
      ))}
    </div>
  );
}

function renderBlock(block: BlogContentBlock, articleTitle: string) {
  switch (block.type) {
    case "paragraph":
      return (
        <p className="mx-auto max-w-prose text-foreground/75 leading-relaxed">
          {block.text}
        </p>
      );
    case "heading":
      return block.level === "h3" ? (
        <h3 className="mx-auto max-w-prose pt-4 text-2xl font-bold leading-tight">
          {block.text}
        </h3>
      ) : (
        <h2 className="mx-auto max-w-prose pt-6 text-3xl font-bold leading-tight">
          {block.text}
        </h2>
      );
    case "quote":
      return (
        <figure className="mx-auto max-w-3xl border-l-2 border-foreground bg-white/70 px-6 py-5">
          <blockquote className="text-2xl font-semibold leading-snug text-foreground">
            {block.text}
          </blockquote>
          {block.caption ? (
            <figcaption className="mt-3 text-sm text-foreground/50">
              {block.caption}
            </figcaption>
          ) : null}
        </figure>
      );
    case "image": {
      const src = blockImageSrc(block.imageUrl);
      if (!src) return null;
      return (
        <figure
          className={cn(
            "mx-auto",
            block.width === "prose" ? "max-w-prose" : "max-w-5xl"
          )}
        >
          <div className="relative aspect-[16/9] overflow-hidden rounded-card bg-neutral-100">
            <Image
              src={src}
              alt={block.alt || articleTitle}
              fill
              sizes="(max-width: 1024px) 100vw, 1024px"
              className="object-cover"
            />
          </div>
          {block.caption ? (
            <figcaption className="mt-2 text-sm text-foreground/50">
              {block.caption}
            </figcaption>
          ) : null}
        </figure>
      );
    }
    case "mediaText": {
      const src = blockImageSrc(block.imageUrl);
      return (
        <section className="mx-auto grid max-w-5xl gap-6 py-4 md:grid-cols-2 md:items-center">
          {src ? (
            <div
              className={cn(
                "relative aspect-[4/3] overflow-hidden rounded-card bg-neutral-100",
                block.imageSide === "right" ? "md:order-2" : ""
              )}
            >
              <Image
                src={src}
                alt={block.alt || block.title || articleTitle}
                fill
                sizes="(max-width: 768px) 100vw, 50vw"
                className="object-cover"
              />
            </div>
          ) : null}
          <div className="space-y-3">
            {block.eyebrow ? (
              <p className="text-xs font-semibold uppercase text-foreground/50">
                {block.eyebrow}
              </p>
            ) : null}
            {block.title ? (
              <h2 className="text-2xl font-bold leading-tight">
                {block.title}
              </h2>
            ) : null}
            {block.text ? (
              <p className="text-foreground/70 leading-relaxed">
                {block.text}
              </p>
            ) : null}
          </div>
        </section>
      );
    }
    case "checklist":
      return (
        <section className="mx-auto max-w-3xl rounded-card border border-border bg-white p-6">
          {block.title ? (
            <h2 className="mb-4 text-xl font-bold">{block.title}</h2>
          ) : null}
          <ul className="space-y-3 text-sm text-foreground/75">
            {(block.items ?? []).map((item) => (
              <li key={item} className="flex gap-3">
                <span aria-hidden="true">-</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>
      );
    case "cta":
      return (
        <section className="mx-auto max-w-4xl rounded-card bg-foreground p-6 text-background md:p-8">
          {block.title ? (
            <h2 className="text-2xl font-bold">{block.title}</h2>
          ) : null}
          {block.text ? (
            <p className="mt-3 max-w-2xl text-background/75">{block.text}</p>
          ) : null}
          {block.href && block.buttonLabel ? (
            <Link
              href={block.href}
              className="mt-5 inline-flex rounded-full bg-background px-5 py-2 text-sm font-semibold text-foreground"
            >
              {block.buttonLabel}
            </Link>
          ) : null}
        </section>
      );
  }
}

export function BlogContentBlocks({ article }: { article: ArticleBody }) {
  const blocks = enabledBlocks(article.contentBlocks);
  if (!blocks.length) {
    return legacyParagraphs(article);
  }

  return (
    <div className="space-y-8">
      {blocks.map((block) => (
        <div key={block.id}>{renderBlock(block, article.title)}</div>
      ))}
    </div>
  );
}
