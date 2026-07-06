import type { Metadata } from "next";
import { WpLegalPage, legalMetadata } from "@/components/layout/WpLegalPage";

export function generateMetadata(): Metadata {
  return legalMetadata("shipping");
}

export default function ShippingPolicyPage() {
  return <WpLegalPage wpSlug="shipping" />;
}
