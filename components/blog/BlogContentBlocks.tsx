"use client";

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

const PROSE_WIDTH = "mx-auto w-full max-w-[680px]";
const WIDE_WIDTH = "mx-auto w-full max-w-5xl";

function enabledBlocks(
  blocks: BlogContentBlock[] | undefined
): BlogContentBlock[] {
  return (blocks ?? [])
    .filter((block) => block.enabled !== false)
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
}

function blockImageSrc(src?: string): string {
  return blogArticleImageSrc({ imageUrl: src ?? "" });
}

function splitParagraphText(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function paragraphKey(text: string, index: number): string {
  return `${index}-${text.slice(0, 32)}`;
}

function ParagraphGroup({ text }: { text: string }) {
  const parts = splitParagraphText(text);
  if (!parts.length) return null;

  return (
    <div className={cn(PROSE_WIDTH, "space-y-4")}>
      {parts.map((part, index) => (
        <p
          key={paragraphKey(part, index)}
          className="text-[17px] leading-[1.75] text-foreground/80"
        >
          {part}
        </p>
      ))}
    </div>
  );
}

function legacyParagraphs(article: ArticleBody) {
  return (
    <div className={cn(PROSE_WIDTH, "space-y-4")}>
      {article.content.map((para, index) => (
        <p
          key={paragraphKey(para, index)}
          className="text-[17px] leading-[1.75] text-foreground/80"
        >
          {para}
        </p>
      ))}
    </div>
  );
}

function renderBlock(block: BlogContentBlock, articleTitle: string) {
  switch (block.type) {
    case "paragraph":
      return <ParagraphGroup text={block.text} />;
    case "heading":
      return block.level === "h3" ? (
        <h3
          className={cn(
            PROSE_WIDTH,
            "text-xl md:text-2xl font-bold leading-tight tracking-tight text-foreground"
          )}
        >
          {block.text}
        </h3>
      ) : (
        <h2
          className={cn(
            PROSE_WIDTH,
            "text-2xl md:text-3xl font-bold leading-tight tracking-tight text-foreground"
          )}
        >
          {block.text}
        </h2>
      );
    case "quote":
      return (
        <figure
          className={cn(
            PROSE_WIDTH,
            "rounded-card border border-border bg-neutral-50/80 px-6 py-5 md:px-8 md:py-6"
          )}
        >
          <blockquote className="text-lg md:text-xl font-medium leading-relaxed text-foreground">
            {block.text}
          </blockquote>
          {block.caption ? (
            <figcaption className="mt-3 text-sm text-foreground/55">
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
            block.width === "prose" ? PROSE_WIDTH : WIDE_WIDTH
          )}
        >
          <div className="relative aspect-[16/9] overflow-hidden rounded-card bg-neutral-100">
            <img
              src={src}
              alt={block.alt || articleTitle}
              className="h-full w-full object-cover"
              loading="lazy"
              decoding="async"
            />
          </div>
          {block.caption ? (
            <figcaption className="mt-3 text-sm text-foreground/55">
              {block.caption}
            </figcaption>
          ) : null}
        </figure>
      );
    }
    case "mediaText": {
      const src = blockImageSrc(block.imageUrl);
      return (
        <section
          className={cn(
            WIDE_WIDTH,
            "grid gap-8 rounded-card border border-border bg-white p-5 md:grid-cols-2 md:items-center md:gap-10 md:p-8"
          )}
        >
          {src ? (
            <div
              className={cn(
                "relative aspect-[4/3] overflow-hidden rounded-card bg-neutral-100",
                block.imageSide === "right" ? "md:order-2" : ""
              )}
            >
              <img
                src={src}
                alt={block.alt || block.title || articleTitle}
                className="h-full w-full object-cover"
                loading="lazy"
                decoding="async"
              />
            </div>
          ) : null}
          <div className="space-y-3 md:py-2">
            {block.eyebrow ? (
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-foreground/50">
                {block.eyebrow}
              </p>
            ) : null}
            {block.title ? (
              <h2 className="text-xl md:text-2xl font-bold leading-tight tracking-tight">
                {block.title}
              </h2>
            ) : null}
            {block.text ? (
              <div className="space-y-3 text-[15px] leading-relaxed text-foreground/80">
                {splitParagraphText(block.text).map((part, index) => (
                  <p key={paragraphKey(part, index)}>{part}</p>
                ))}
              </div>
            ) : null}
          </div>
        </section>
      );
    }
    case "checklist":
      return (
        <section
          className={cn(
            PROSE_WIDTH,
            "rounded-card border border-border bg-white p-6 md:p-7"
          )}
        >
          {block.title ? (
            <h2 className="mb-4 text-xl font-bold tracking-tight">
              {block.title}
            </h2>
          ) : null}
          <ul className="space-y-3">
            {(block.items ?? []).map((item) => (
              <li
                key={item}
                className="flex gap-3 text-[15px] leading-relaxed text-foreground/80"
              >
                <span
                  aria-hidden="true"
                  className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-foreground"
                />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>
      );
    case "cta":
      return (
        <section
          className={cn(
            WIDE_WIDTH,
            "rounded-card bg-foreground px-6 py-7 text-background md:px-8 md:py-9"
          )}
        >
          {block.title ? (
            <h2 className="text-2xl font-bold tracking-tight">{block.title}</h2>
          ) : null}
          {block.text ? (
            <div className="mt-3 max-w-2xl space-y-3 text-base leading-relaxed text-background/80">
              {splitParagraphText(block.text).map((part, index) => (
                <p key={paragraphKey(part, index)}>{part}</p>
              ))}
            </div>
          ) : null}
          {block.href && block.buttonLabel ? (
            <Link
              href={block.href}
              className="mt-6 inline-flex rounded-full bg-background px-5 py-2.5 text-sm font-semibold text-foreground transition-opacity hover:opacity-90"
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
    <div className="blog-article-body space-y-8 md:space-y-10">
      {blocks.map((block) => (
        <div key={block.id}>{renderBlock(block, article.title)}</div>
      ))}
    </div>
  );
}

export function articleHeroDuplicatesFirstMediaBlock(
  article: Pick<BlogArticleApi, "imageUrl" | "contentBlocks">
): boolean {
  const hero = blogArticleImageSrc(article);
  if (!hero) return false;

  const first = enabledBlocks(article.contentBlocks)[0];
  if (!first || first.type !== "mediaText") return false;

  const blockImage = blockImageSrc(first.imageUrl);
  return Boolean(blockImage && blockImage === hero);
}
