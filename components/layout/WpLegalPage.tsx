import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { PolicyPageContent } from "@/app/pages/[handle]/PolicyPageContent";
import { StaticPageContent } from "@/components/layout/StaticPageContent";
import { JsonLd } from "@/components/seo/JsonLd";
import { LEGAL_WP_SLUGS } from "@/lib/data/legal-routes";
import { getPolicyPageEn, isPolicyHandle } from "@/lib/data/policy-pages";
import { getInfoPageEn, isInfoPageHandle } from "@/lib/data/info-pages";
import { getPageByHandle } from "@/lib/data/content";
import { breadcrumbJsonLd } from "@/lib/seo";

type Props = { wpSlug: string };

export function legalMetadata(wpSlug: string): Metadata {
  const meta = LEGAL_WP_SLUGS[wpSlug];
  if (!meta) return { title: "Page" };
  if (meta.kind === "policy" && isPolicyHandle(meta.handle)) {
    const page = getPolicyPageEn(meta.handle);
    return { title: page.title, description: page.description };
  }
  if (meta.kind === "page" && isInfoPageHandle(meta.handle)) {
    const page = getInfoPageEn(meta.handle);
    return { title: page.title, description: page.description };
  }
  const page = getPageByHandle(meta.handle);
  if (!page) return { title: "Page" };
  return { title: page.title, description: page.description };
}

export function WpLegalPage({ wpSlug }: Props) {
  const meta = LEGAL_WP_SLUGS[wpSlug];
  if (!meta) notFound();

  if (meta.kind === "policy" && isPolicyHandle(meta.handle)) {
    const page = getPolicyPageEn(meta.handle);
    const breadcrumbs = breadcrumbJsonLd([
      { name: "Home", path: "/" },
      { name: page.title, path: `/${wpSlug}` },
    ]);
    return (
      <>
        <JsonLd data={breadcrumbs} />
        <PolicyPageContent handle={meta.handle} />
      </>
    );
  }

  const page = getPageByHandle(meta.handle);
  if (!page && !isInfoPageHandle(meta.handle)) notFound();

  const title = isInfoPageHandle(meta.handle)
    ? getInfoPageEn(meta.handle).title
    : page!.title;

  const breadcrumbs = breadcrumbJsonLd([
    { name: "Home", path: "/" },
    { name: title, path: `/${wpSlug}` },
  ]);

  return (
    <>
      <JsonLd data={breadcrumbs} />
      {isInfoPageHandle(meta.handle) ? (
        <StaticPageContent handle={meta.handle} />
      ) : (
        <StaticPageContent page={page!} />
      )}
    </>
  );
}
