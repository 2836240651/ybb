import type { Metadata } from "next";
import Script from "next/script";
import { Inter } from "next/font/google";
import { Providers } from "@/components/providers/Providers";
import { CartDrawer } from "@/components/cart/CartDrawer";
import { QuorlyxEmbed } from "@/components/chat/QuorlyxEmbed";
import { Footer } from "@/components/layout/Footer";
import { SiteChrome } from "@/components/layout/SiteChrome";
import { MobileDock } from "@/components/layout/MobileDock";
import { MobileNavDrawer } from "@/components/layout/MobileNavDrawer";
import { ProductQuickViewModal } from "@/components/product/ProductQuickViewModal";
import { SearchDrawer } from "@/components/layout/SearchDrawer";
import { PageTransitionOverlay } from "@/components/layout/PageTransition";
import { SkipLink } from "@/components/layout/SkipLink";
import { JsonLd } from "@/components/seo/JsonLd";
import { defaultMetadata, organizationJsonLd } from "@/lib/seo";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = defaultMetadata;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} antialiased`}>
        <Script src="/hard-nav-capture.js" strategy="beforeInteractive" />
        <Providers>
          <JsonLd data={organizationJsonLd()} />
          <SkipLink />
          <SiteChrome />
          <main id="main-content" className="pb-[calc(5rem+env(safe-area-inset-bottom,0px))] lg:pb-0">
            {children}
          </main>
          <Footer />
          <CartDrawer />
          <SearchDrawer />
          <ProductQuickViewModal />
          <QuorlyxEmbed />
          <MobileNavDrawer />
          <MobileDock />
          <PageTransitionOverlay />
        </Providers>
      </body>
    </html>
  );
}
