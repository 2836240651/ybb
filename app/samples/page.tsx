import type { Metadata } from "next";
import { WpLegalPage, legalMetadata } from "@/components/layout/WpLegalPage";

export function generateMetadata(): Metadata {
  return legalMetadata("samples");
}

export default function SamplesPolicyPage() {
  return <WpLegalPage wpSlug="samples" />;
}
