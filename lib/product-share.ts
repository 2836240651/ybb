import { chatConfig } from "@/lib/chat-config";

const DEFAULT_SALES_EMAIL = "carpybb@gmail.com";

/** Social profile URLs (same as footer / contact page). */
export const SOCIAL_PROFILE_URLS = {
  facebook: "https://www.facebook.com/share/1ZyUpncUzd/?mibextid=wwXIfr",
  x: "https://x.com/yotofisher?s=11",
  instagram: "https://www.instagram.com/carp_ybb?igsh=aWg5M20wNGQ2N3Jo&utm_source=qr",
  tiktok: "https://www.tiktok.com/@carp_ybb?_r=1&_t=ZT-97J295lPDfa",
  snapchat: "https://snapchat.com/t/X94QfY13",
  whatsapp: chatConfig.whatsappHref,
} as const;

export type ProductShareLinks = {
  facebook: string;
  x: string;
  whatsapp: string;
  email: string;
};

/** Build share URLs for PDP social row (share product + real contact endpoints). */
export function buildProductShareLinks(
  productTitle: string,
  productUrl: string,
  salesEmail = DEFAULT_SALES_EMAIL
): ProductShareLinks {
  const encodedUrl = encodeURIComponent(productUrl);
  const encodedTitle = encodeURIComponent(productTitle);
  const shareText = encodeURIComponent(`${productTitle} �?${productUrl}`);

  return {
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
    x: `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}`,
    whatsapp: `https://wa.me/?text=${shareText}`,
    email: `mailto:${salesEmail}?subject=${encodedTitle}&body=${shareText}`,
  };
}
