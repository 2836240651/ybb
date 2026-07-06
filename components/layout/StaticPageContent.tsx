"use client";

import { useI18n } from "@/lib/i18n/I18nProvider";
import { getInfoPage, isInfoPageHandle } from "@/lib/data/info-pages";
import type { StaticPage } from "@/lib/data/content";

type Props =
  | { handle: string; page?: never }
  | { page: StaticPage; handle?: never };

/** Renders localized info pages or static pages.json content. */
export function StaticPageContent({ handle, page }: Props) {
  const { locale } = useI18n();
  const content =
    handle && isInfoPageHandle(handle)
      ? getInfoPage(handle, locale)
      : page!;

  return (
    <article className="policy-page page-container py-12 md:py-16 lg:py-20">
      <header className="policy-page__header max-w-3xl mb-10 md:mb-12">
        <h1 className="policy-page__title text-title-md mb-4">{content.title}</h1>
        {content.description ? (
          <p className="policy-page__lead text-foreground/60 leading-relaxed">
            {content.description}
          </p>
        ) : null}
      </header>
      <div className="policy-page__body max-w-3xl space-y-8 md:space-y-10">
        {content.sections.map((section) => (
          <section key={section.heading} className="policy-page__section">
            <h2 className="policy-page__section-title mb-3 md:mb-4">{section.heading}</h2>
            <div className="policy-page__section-body space-y-3 text-foreground/70 leading-relaxed">
              {section.paragraphs.map((para) => (
                <p key={para.slice(0, 48)}>{para}</p>
              ))}
            </div>
          </section>
        ))}
      </div>
    </article>
  );
}
