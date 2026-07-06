import type { Metadata } from "next";
import { BlogCarousel } from "@/components/home/BlogCarousel";
import { CategoryGrid } from "@/components/home/CategoryGrid";
import { FeaturedProduct } from "@/components/home/FeaturedProduct";
import { HeroCarousel } from "@/components/home/HeroCarousel";
import { HotProductsCarousel } from "@/components/home/HotProductsCarousel";
import { RecentlyViewedCarousel } from "@/components/home/RecentlyViewedCarousel";
import { ServiceTrustBar } from "@/components/home/ServiceTrustBar";
import { VideoWithText } from "@/components/home/VideoWithText";
import { isWholesaleCollectionsEnabled } from "@/lib/home-settings";
import { JsonLd } from "@/components/seo/JsonLd";
import navigation from "@/lib/data/navigation.json";
import { SITE_URL } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Wholesale Terminal Tackle Factory",
  description:
    "B2B carp and coarse terminal tackle from YBB Tackle �?OEM/ODM, 10,000+ SKUs, mixed-carton wholesale.",
  openGraph: {
    title: `${navigation.brand.name} �?Wholesale Terminal Tackle Factory`,
    url: SITE_URL,
  },
};

const homeJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: navigation.brand.name,
  url: SITE_URL,
  potentialAction: {
    "@type": "SearchAction",
    target: `${SITE_URL}/collections/new-arrivals?q={search_term_string}`,
    "query-input": "required name=search_term_string",
  },
};

export default function Home() {
  return (
    <>
      <JsonLd data={homeJsonLd} />
      <div className="home-sections">
        <HeroCarousel />
        <FeaturedProduct />
        {isWholesaleCollectionsEnabled() ? <CategoryGrid /> : null}
        <HotProductsCarousel />
        <VideoWithText />
        <BlogCarousel />
        <ServiceTrustBar />
        <RecentlyViewedCarousel />
      </div>
    </>
  );
}
