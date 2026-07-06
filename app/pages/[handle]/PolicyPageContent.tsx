"use client";

import { useI18n } from "@/lib/i18n/I18nProvider";
import { getPolicyPage, type PolicyHandle } from "@/lib/data/policy-pages";

type Props = {
  handle: PolicyHandle;
};

export function PolicyPageContent({ handle }: Props) {
  const { locale } = useI18n();
  const page = getPolicyPage(handle, locale);

  return (
    <article className="policy-page page-container py-12 md:py-16 lg:py-20">
      <header className="policy-page__header max-w-3xl mb-10 md:mb-12">
        <h1 className="policy-page__title text-title-md mb-4">{page.title}</h1>
        {page.description ? (
          <p className="policy-page__lead text-foreground/60 leading-relaxed">
            {page.description}
          </p>
        ) : null}
      </header>

      <div className="policy-page__body max-w-3xl space-y-8 md:space-y-10">
        {page.sections.map((section) => (
          <section key={section.heading || section.paragraphs[0]?.slice(0, 48)} className="policy-page__section">
            {section.heading ? (
              <h2 className="policy-page__section-title mb-3 md:mb-4">
                {section.heading}
              </h2>
            ) : null}
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
