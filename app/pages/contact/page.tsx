import type { Metadata } from "next";
import { ContactPageContent } from "./ContactPageContent";

export const metadata: Metadata = {
  title: "Contact & RFQ",
  description:
    "Contact YBB Tackle for wholesale quotes, OEM/ODM programs, and sample requests.",
};

export default function ContactPage() {
  return <ContactPageContent />;
}
