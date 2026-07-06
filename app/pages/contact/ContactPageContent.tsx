"use client";

import navigation from "@/lib/data/navigation.json";
import { ContactForm } from "./ContactForm";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { useYbbContact } from "@/lib/site-manager/contact-api";

export function ContactPageContent() {
  const { t } = useI18n();
  const { config } = useYbbContact();

  return (
    <main className="page-container py-12 md:py-16 lg:py-20">
      <div className="contact-page__layout mx-auto w-full max-w-lg">
        <div className="contact-page__main">
          <h1 className="text-title-md mb-4">{t("contact.title")}</h1>
          <p className="text-sm opacity-70 mb-8 leading-relaxed whitespace-pre-line">
            {config.intro}
          </p>
          <ContactForm salesEmail={config.salesEmail} />
        </div>

        <aside className="mt-12 pt-10 border-t border-border space-y-8">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider mb-3">
              {t("contact.companyLegalNameZh")}
            </h2>
            <p className="text-sm text-foreground/70">{config.companyLegalNameZh}</p>
            <p className="text-sm text-foreground/70 mt-1">{config.companyLegalName}</p>
          </div>
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider mb-3">
              {t("contact.phone")}
            </h2>
            <p className="text-sm">
              <a
                href={`tel:${config.phoneNumber.replace(/\s/g, "")}`}
                className="hover:opacity-70 transition-opacity"
              >
                {config.phoneNumber}
              </a>
            </p>
          </div>
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider mb-3">
              {t("contact.sales")}
            </h2>
            <p className="text-sm">
              <a
                href={`mailto:${config.salesEmail}`}
                className="hover:opacity-70 transition-opacity"
              >
                {config.salesEmail}
              </a>
            </p>
          </div>
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider mb-3">
              {t("contact.factoryHours")}
            </h2>
            <p className="text-sm text-foreground/60 whitespace-pre-line">
              {config.hoursDetail}
            </p>
          </div>
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider mb-3">
              {t("contact.follow")}
            </h2>
            <ul className="space-y-2">
              {navigation.footer.social.map((s) => (
                <li key={s.label}>
                  <a
                    href={s.href}
                    className="text-sm hover:opacity-70 transition-opacity"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {s.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </main>
  );
}
