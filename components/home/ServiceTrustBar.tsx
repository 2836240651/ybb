"use client";

import Link from "next/link";
import { ScrollReveal } from "@/components/motion/ScrollReveal";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { cn } from "@/lib/utils";

const ITEMS = [
  { id: "shipping", icon: ShippingIcon },
  { id: "support", icon: SupportIcon },
  { id: "payment", icon: PaymentIcon },
  { id: "articles", icon: ArticlesIcon, href: "/blogs/news" },
] as const;

function ShippingIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path d="M3 7h11v8H3zM14 10h4l3 3v2h-7V10z" strokeLinejoin="round" />
      <circle cx="7" cy="17" r="2" />
      <circle cx="17" cy="17" r="2" />
    </svg>
  );
}

function SupportIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path d="M4 8a8 8 0 0116 0v3a3 3 0 01-3 3h-1l-2 3v-3H9a3 3 0 01-3-3V8z" strokeLinejoin="round" />
    </svg>
  );
}

function PaymentIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <path d="M3 10h18" />
    </svg>
  );
}

function ArticlesIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path d="M6 4h9l3 3v13H6z" strokeLinejoin="round" />
      <path d="M15 4v3h3M8 12h8M8 16h6" strokeLinecap="round" />
    </svg>
  );
}

export function ServiceTrustBar() {
  const { t } = useI18n();

  return (
    <section
      className="service-trust-bar border-y border-border bg-neutral-100"
      aria-label={t("home.serviceBarAria")}
    >
      <div className="page-container py-8 md:py-10">
        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-0">
          {ITEMS.map((item, index) => {
            const Icon = item.icon;
            const label = t(`home.serviceBar.${item.id}`);
            const content = (
              <>
                <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center text-foreground/80">
                  <Icon />
                </span>
                <span className="text-sm font-medium leading-snug text-center text-foreground/90">
                  {label}
                </span>
              </>
            );

            return (
              <li
                key={item.id}
                className={cn(
                  "flex flex-col items-center justify-center gap-3 px-4 py-4 text-center",
                  "sm:odd:border-r sm:even:lg:border-r border-border/60",
                  index < 3 && "lg:border-r lg:border-border/60"
                )}
              >
                <ScrollReveal animate="fade-up" staggerIndex={index} className="w-full">
                {"href" in item && item.href ? (
                  <Link
                    href={item.href}
                    className="flex flex-col items-center gap-3 transition-opacity hover:opacity-70"
                  >
                    {content}
                  </Link>
                ) : (
                  <div className="flex flex-col items-center gap-3">{content}</div>
                )}
                </ScrollReveal>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
