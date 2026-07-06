"use client";

import { useI18n } from "@/lib/i18n/I18nProvider";

function ArrowRightIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

export function FooterNewsletter() {
  const { t } = useI18n();

  return (
    <div className="footer-newsletter">
      <h2 className="footer-newsletter-heading">{t("footer.newsletter")}</h2>
      <form
        className="footer-newsletter-form"
        onSubmit={(e) => e.preventDefault()}
      >
        <div className="footer-newsletter-field">
          <input
            type="email"
            placeholder={t("footer.enterEmail")}
            className="footer-newsletter-input"
            aria-label={t("footer.emailAddress")}
            autoComplete="email"
          />
          <button
            type="submit"
            className="footer-newsletter-submit interaction-cta"
            aria-label={t("footer.subscribe")}
          >
            <ArrowRightIcon className="h-4 w-4" />
          </button>
        </div>
      </form>
      <p className="footer-newsletter-desc">{t("footer.newsletterDesc")}</p>
    </div>
  );
}
