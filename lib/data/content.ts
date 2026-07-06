import pagesData from "./pages.json";
import blogData from "./blog.json";

export type PageSection = {
  heading: string;
  paragraphs: string[];
};

export type StaticPage = {
  handle: string;
  title: string;
  description: string;
  sections: PageSection[];
};

export type BlogArticle = {
  handle: string;
  title: string;
  excerpt: string;
  publishedAt: string;
  image: string;
  author: string;
  content: string[];
};

export type Blog = {
  handle: string;
  title: string;
  description: string;
  articles: BlogArticle[];
};

export const pages = pagesData as StaticPage[];
export const blog = blogData as Blog;

export function getPageByHandle(handle: string): StaticPage | undefined {
  return pages.find((p) => p.handle === handle);
}

export function getBlogArticle(
  blogHandle: string,
  articleHandle: string
): BlogArticle | undefined {
  if (blog.handle !== blogHandle) return undefined;
  return blog.articles.find((a) => a.handle === articleHandle);
}
