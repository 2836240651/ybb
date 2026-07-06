import type { Metadata } from "next";
import { OemPageContent } from "@/components/pages/OemOdmOverviewContent";
import { JsonLd } from "@/components/seo/JsonLd";
import { getPageByHandle } from "@/lib/data/content";
import { breadcrumbJsonLd } from "@/lib/seo";

export function generateMetadata(): Metadata {
  const page = getPageByHandle("moq-lead-time");
  return {
    title: page?.title ?? "MOQ & Lead Time",
    description: page?.description,
  };
}

export default function MoqLeadTimePage() {
  const page = getPageByHandle("moq-lead-time");
  const breadcrumbs = breadcrumbJsonLd([
    { name: "Home", path: "/" },
    { name: page?.title ?? "MOQ & Lead Time", path: "/moq-lead-time" },
  ]);

  return (
    <>
      <JsonLd data={breadcrumbs} />
      <OemPageContent handle="moq-lead-time" />
    </>
  );
}
