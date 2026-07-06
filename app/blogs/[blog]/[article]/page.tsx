import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { JsonLd } from "@/components/seo/JsonLd";
import { BlogArticleView } from "@/components/blog/BlogArticleView";
import { blog, getBlogArticle } from "@/lib/data/content";
import { breadcrumbJsonLd } from "@/lib/seo";

type Props = { params: Promise<{ blog: string; article: string }> };

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
    title: article.title,
    description: article.excerpt,
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
      name: article.title,
      path: `/blogs/${blogHandle}/${articleHandle}`,
    },
  ]);

  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: article.title,
    datePublished: article.publishedAt,
    author: { "@type": "Person", name: article.author },
    image: article.image,
    description: article.excerpt,
  };

  return (
    <>
      <JsonLd data={[breadcrumbs, articleJsonLd]} />
      <BlogArticleView
        blogHandle={blogHandle}
        articleHandle={articleHandle}
        fallbackBlog={blog}
        fallbackArticle={article}
      />
    </>
  );
}
