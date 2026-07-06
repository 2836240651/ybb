import type { Metadata } from "next";
import { JsonLd } from "@/components/seo/JsonLd";
import { BlogIndexView } from "@/components/blog/BlogIndexView";
import { blog } from "@/lib/data/content";
import { breadcrumbJsonLd } from "@/lib/seo";

type Props = { params: Promise<{ blog: string }> };

export function generateStaticParams() {
  return [{ blog: blog.handle }];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { blog: blogHandle } = await params;
  if (blogHandle !== blog.handle) return { title: "Blog" };
  return {
    title: blog.title,
    description: blog.description,
  };
}

export default async function BlogIndexPage({ params }: Props) {
  const { blog: blogHandle } = await params;

  const breadcrumbs = breadcrumbJsonLd([
    { name: "Home", path: "/" },
    { name: blog.title, path: `/blogs/${blog.handle}` },
  ]);

  return (
    <>
      <JsonLd data={breadcrumbs} />
      <BlogIndexView blogHandle={blogHandle} fallback={blog} />
    </>
  );
}
