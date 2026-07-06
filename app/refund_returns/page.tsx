import type { Metadata } from "next";
import { WpLegalPage, legalMetadata } from "@/components/layout/WpLegalPage";

export function generateMetadata(): Metadata {
  return legalMetadata("refund_returns");
}

export default function RefundPolicyPage() {
  return <WpLegalPage wpSlug="refund_returns" />;
}
