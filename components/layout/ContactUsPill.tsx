"use client";

import Link from "next/link";
import { chatConfig } from "@/lib/chat-config";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { cn } from "@/lib/utils";

function MailIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={cn("h-5 w-5 shrink-0", className)}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M4 6h16v12H4z" />
      <path d="m4 7 8 6 8-6" />
    </svg>
  );
}

type ContactUsPillProps = {
  className?: string;
  compact?: boolean;
};

/** Header Contact Us pill �?links to RFQ form; live chat is Quorlyx. */
export function ContactUsPill({ className, compact = false }: ContactUsPillProps) {
  const { t } = useI18n();

  return (
    <Link
      href={chatConfig.contactHref}
      className={cn(
        "inline-flex items-center gap-2 rounded-full shadow-lg",
        "transition-[transform,box-shadow,opacity] duration-500 ease-primary",
        "hover:scale-[1.02] active:scale-[0.98]",
        compact ? "px-3 py-2" : "px-4 py-2.5 sm:px-5 sm:py-3",
        "text-sm font-medium whitespace-nowrap",
        className
      )}
      style={{
        backgroundColor: chatConfig.colors.primary,
        color: chatConfig.colors.secondary,
      }}
    >
      <MailIcon />
      <span className={cn(compact ? "sr-only" : "hidden sm:inline")}>
        {t("common.contactUs")}
      </span>
    </Link>
  );
}
