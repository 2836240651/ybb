import type { Metadata } from "next";
import { WpLegalPage, legalMetadata } from "@/components/layout/WpLegalPage";

export function generateMetadata(): Metadata {
  return legalMetadata("terms");
}

export default function TermsPage() {
  return <WpLegalPage wpSlug="terms" />;
}
