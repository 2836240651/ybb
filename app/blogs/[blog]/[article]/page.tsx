import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { JsonLd } from "@/components/seo/JsonLd";
import { BlogArticleView } from "@/components/blog/BlogArticleView";
import { blog, getBlogArticle } from "@/lib/data/content";
import { breadcrumbJsonLd } from "@/lib/seo";

type Props = { params: Promise<{ blog: string; article: string }> };

function titleFromHandle(handle: string): string {
  return handle
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function generateStaticParams() {
  return blog.articles.map((a) => ({
    blog: blog.handle,
    article: a.handle,
  }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { blog: blogHandle, article: articleHandle } = await params;
  const article = getBlogArticle(blogHandle, articleHandle);
  if (!article) return { title: "Article" };
  return {
    title: titleFromHandle(articleHandle),
    description: "YBB news and insights.",
  };
}

export default async function BlogArticlePage({ params }: Props) {
  const { blog: blogHandle, article: articleHandle } = await params;
  const article = getBlogArticle(blogHandle, articleHandle);
  if (!article) notFound();

  const breadcrumbs = breadcrumbJsonLd([
    { name: "Home", path: "/" },
    { name: blog.title, path: `/blogs/${blog.handle}` },
    {
      name: titleFromHandle(articleHandle),
      path: `/blogs/${blogHandle}/${articleHandle}`,
    },
  ]);

  const minimalArticleFallback = {
    handle: article.handle,
    title: article.title,
    excerpt: article.excerpt,
    publishedAt: article.publishedAt,
    image: article.image,
    author: article.author,
    content: article.content,
  };

  return (
    <>
      <JsonLd data={breadcrumbs} />
      <BlogArticleView
        blogHandle={blogHandle}
        articleHandle={articleHandle}
        fallbackBlog={blog}
        fallbackArticle={minimalArticleFallback}
      />
    </>
  );
}
