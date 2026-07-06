import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { JsonLd } from "@/components/seo/JsonLd";
import { TrustBadges } from "@/components/home/TrustBadges";
import { getPageByHandle, pages } from "@/lib/data/content";
import {
  getPolicyPageEn,
  isPolicyHandle,
  policyHandles,
} from "@/lib/data/policy-pages";
import { breadcrumbJsonLd } from "@/lib/seo";
import { PolicyPageContent } from "./PolicyPageContent";
import { StaticPageContent } from "@/components/layout/StaticPageContent";
import { OemPageContent } from "@/components/pages/OemOdmOverviewContent";
import { getInfoPageEn, isInfoPageHandle } from "@/lib/data/info-pages";
import { isOemOverviewHandle } from "@/lib/data/oem-pages";

type Props = { params: Promise<{ handle: string }> };

export function generateStaticParams() {
  return [
    ...pages.map((p) => ({ handle: p.handle })),
    ...policyHandles.map((handle) => ({ handle })),
  ];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { handle } = await params;
  if (isPolicyHandle(handle)) {
    const page = getPolicyPageEn(handle);
    return { title: page.title, description: page.description };
  }
  const page = getPageByHandle(handle);
  if (!page) return { title: "Page" };
  return {
    title: page.title,
    description: page.description,
  };
}

export default async function StaticPage({ params }: Props) {
  const { handle } = await params;

  if (isPolicyHandle(handle)) {
    const page = getPolicyPageEn(handle);
    const breadcrumbs = breadcrumbJsonLd([
      { name: "Home", path: "/" },
      { name: page.title, path: `/pages/${handle}` },
    ]);
    return (
      <>
        <JsonLd data={breadcrumbs} />
        <PolicyPageContent handle={handle} />
      </>
    );
  }

  if (isInfoPageHandle(handle)) {
    const page = getInfoPageEn(handle);
    const breadcrumbs = breadcrumbJsonLd([
      { name: "Home", path: "/" },
      { name: page.title, path: `/pages/${handle}` },
    ]);
    return (
      <>
        <JsonLd data={breadcrumbs} />
        <StaticPageContent handle={handle} />
      </>
    );
  }

  const page = getPageByHandle(handle);
  if (!page) notFound();

  const breadcrumbs = breadcrumbJsonLd([
    { name: "Home", path: "/" },
    { name: page.title, path: `/pages/${handle}` },
  ]);

  if (isOemOverviewHandle(handle)) {
    return (
      <>
        <JsonLd data={breadcrumbs} />
        <OemPageContent handle={handle} />
      </>
    );
  }

  return (
    <>
      <JsonLd data={breadcrumbs} />
      <div className="page-container py-16">
        <header className="max-w-3xl mb-12">
          <p className="text-sm uppercase tracking-widest text-foreground/50 mb-2">
            YBB Tackle
          </p>
          <h1 className="text-title-md mb-4">{page.title}</h1>
          <p className="text-foreground/60 leading-relaxed">{page.description}</p>
        </header>

        <div className="max-w-prose space-y-10">
          {page.sections.map((section) => (
            <section key={section.heading}>
              <h2 className="text-xl font-bold mb-4">{section.heading}</h2>
              <div className="space-y-4 text-foreground/70 leading-relaxed">
                {section.paragraphs.map((para) => (
                  <p key={para.slice(0, 40)}>{para}</p>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
      <TrustBadges />
    </>
  );
}
