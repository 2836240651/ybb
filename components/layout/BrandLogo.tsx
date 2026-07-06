"use client";

import Image from "next/image";
import Link from "next/link";
import {
  getBrandLogoPath,
  getBrandName,
  getBrandTagline,
} from "@/lib/brand";
import { hardNavFallback } from "@/lib/navigation/hard-nav-fallback";
import { useYbbSiteBrand } from "@/lib/site-manager/home-modules-api";
import { resolveTriLabel } from "@/lib/site-manager/labels";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { cn } from "@/lib/utils";

type BrandLogoProps = {
  showText?: boolean;
  showTagline?: boolean;
  layout?: "inline" | "stacked";
  className?: string;
  imageClassName?: string;
};

export function BrandLogo({
  showText = true,
  showTagline = true,
  layout = "inline",
  className,
  imageClassName,
}: BrandLogoProps) {
  const { locale } = useI18n();
  const { brand } = useYbbSiteBrand();
  const name = brand?.name || getBrandName();
  const tagline =
    resolveTriLabel(brand?.tagline, locale, "") || getBrandTagline(locale);
  const logoPath = brand?.logoPath ? brand.logoPath : getBrandLogoPath();

  return (
    <Link
      href="/"
      onClick={(event) => hardNavFallback(event, "/")}
      className={cn(
        "header-logo-zone inline-flex min-w-0 items-center gap-2.5 text-inherit no-underline",
        layout === "stacked" && "flex-col items-start gap-2",
        className
      )}
      aria-label={`${name} �?${tagline}`}
    >
      <Image
        src={logoPath.startsWith("/") ? logoPath : getBrandLogoPath()}
        alt=""
        width={56}
        height={56}
        className={cn(
          "header-logo-mark h-11 w-11 shrink-0 object-contain",
          imageClassName
        )}
        priority
      />
      {(showText || showTagline) && (
        <span
          className={cn(
            "header-logo-text min-w-0",
            layout === "inline" ? "flex flex-col justify-center" : "flex flex-col"
          )}
        >
          {showText && (
            <span className="header-logo-title truncate font-bold text-lg uppercase tracking-tight">
              {name}
            </span>
          )}
          {showTagline && (
            <span className="header-logo-tagline line-clamp-2">{tagline}</span>
          )}
        </span>
      )}
    </Link>
  );
}
