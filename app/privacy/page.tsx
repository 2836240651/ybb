import type { Metadata } from "next";
import { WpLegalPage, legalMetadata } from "@/components/layout/WpLegalPage";

export function generateMetadata(): Metadata {
  return legalMetadata("privacy");
}

export default function PrivacyPolicyPage() {
  return <WpLegalPage wpSlug="privacy" />;
}
