import type { Metadata } from "next";
import { getBrandName, getBrandTagline } from "@/lib/brand";
import type { Product } from "@/lib/types/product";

export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://carp-ybb.com";

const brandName = getBrandName();
const brandTagline = getBrandTagline("en");

export const defaultMetadata: Metadata = {
  title: {
    default: `${brandName} �?${brandTagline}`,
    template: `%s | ${brandName}`,
  },
  description:
    "B2B carp and coarse fishing terminal tackle manufacturer. OEM/ODM, mixed-carton wholesale, 10,000+ SKUs from source factory.",
  openGraph: {
    siteName: brandName,
    locale: "en_GB",
    type: "website",
  },
  metadataBase: new URL(SITE_URL),
  icons: {
    icon: "/images/brand/ybb-logo.png",
    apple: "/images/brand/ybb-logo.png",
  },
};

export function absoluteUrl(path: string): string {
  const base = SITE_URL.replace(/\/$/, "");
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${base}${normalized}`;
}

export function organizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: brandName,
    url: SITE_URL,
    description: defaultMetadata.description as string,
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "sales",
      email: "carpybb@gmail.com",
      availableLanguage: ["English", "Chinese"],
    },
  };
}

export function productJsonLd(product: Product) {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    sku: product.handle,
    image: product.images.map((img) => absoluteUrl(img)),
    brand: {
      "@type": "Brand",
      name: brandName,
    },
    offers: {
      "@type": "Offer",
      priceCurrency: "GBP",
      price: product.price.toFixed(2),
      availability: product.available
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
      url: absoluteUrl(`/products/${product.handle}`),
    },
  };
}

export function breadcrumbJsonLd(
  items: Array<{ name: string; path: string }>
) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

export function collectionJsonLd(
  title: string,
  handle: string,
  description: string
) {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: title,
    description,
    url: absoluteUrl(`/collections/${handle}`),
    isPartOf: {
      "@type": "WebSite",
      name: brandName,
      url: SITE_URL,
    },
  };
}
