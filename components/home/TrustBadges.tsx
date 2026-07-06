"use client";

import { useI18n } from "@/lib/i18n/I18nProvider";

const BADGE_SECTIONS = [
  {
    id: "factory",
    items: ["factory-direct", "moq-flexible"],
  },
  {
    id: "quality",
    items: ["qc-at-source", "global-shipping"],
  },
] as const;

export function TrustBadges() {
  const { t } = useI18n();

  return (
    <>
      {BADGE_SECTIONS.map((section, sectionIndex) => (
        <section
          key={section.id}
          className="border-t border-border bg-neutral-50"
          aria-labelledby={`trust-${section.id}-heading`}
        >
          <div className="page-container py-10 md:py-12 lg:py-14">
            <h2
              id={`trust-${section.id}-heading`}
              className="text-title-sm mb-8 md:mb-10 tracking-tight"
            >
              {t(`trust.${section.id}.heading`)}
            </h2>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-8 md:gap-10 lg:gap-12">
              {section.items.map((itemId) => {
                const title = t(`trust.${section.id}.${itemId}.title`);
                return (
                  <li
                    key={itemId}
                    className="flex flex-col gap-3 border-border sm:odd:border-r sm:odd:pr-8 lg:pr-12"
                  >
                    <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-foreground text-background text-sm font-bold">
                      {title.charAt(0)}
                    </span>
                    <h3 className="text-lg font-bold tracking-tight">{title}</h3>
                    <p className="text-base text-foreground/70 leading-relaxed max-w-md">
                      {t(`trust.${section.id}.${itemId}.description`)}
                    </p>
                  </li>
                );
              })}
            </ul>
          </div>
          {sectionIndex < BADGE_SECTIONS.length - 1 && (
            <div className="page-container">
              <hr className="border-border" />
            </div>
          )}
        </section>
      ))}
    </>
  );
}
