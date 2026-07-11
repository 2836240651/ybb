"use client";

import { FormEvent, useState } from "react";
import {
  submitContactInquiry,
  type ContactSubject,
} from "@/lib/contact-inquiry";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { cn } from "@/lib/utils";

type FormState = "idle" | "submitting" | "success" | "error";

type ContactFormProps = {
  salesEmail?: string;
};

export function ContactForm({ salesEmail = "ybb.sales@yoto.work" }: ContactFormProps) {
  const { t, locale } = useI18n();
  const [state, setState] = useState<FormState>("idle");
  const [toast, setToast] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const showCaptchaHint =
    process.env.NEXT_PUBLIC_CONTACT_SHOW_CAPTCHA_HINT === "1";

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (state === "submitting") return;

    const form = e.currentTarget;
    const data = new FormData(form);
    const website = String(data.get("website") ?? "").trim();
    if (website) {
      setState("success");
      return;
    }

    const subject = String(data.get("subject") ?? "") as ContactSubject;
    const payload = {
      name: String(data.get("name") ?? "").trim(),
      email: String(data.get("email") ?? "").trim(),
      company: String(data.get("company") ?? "").trim(),
      subject,
      message: String(data.get("message") ?? "").trim(),
      locale,
      website: "",
    };

    setState("submitting");
    setErrorMessage(null);

    try {
      await submitContactInquiry(payload);
      setState("success");
      setToast(true);
      form.reset();
      window.setTimeout(() => setToast(false), 4000);
    } catch (err) {
      const status = (err as Error & { status?: number }).status;
      const message =
        status === 429
          ? t("contact.submitErrorRateLimit")
          : err instanceof Error && err.message
            ? err.message
            : t("contact.submitError", { email: salesEmail });
      setErrorMessage(message);
      setState("error");
    }
  }

  if (state === "success") {
    return (
      <div
        className="w-full rounded-card border border-border bg-[rgb(var(--color-success-text)/0.05)] p-8 text-center"
        role="status"
      >
        <p className="text-lg font-bold mb-2">{t("contact.inquiryReceived")}</p>
        <p className="text-sm text-foreground/60 mb-6">{t("contact.thankYou")}</p>
        <button
          type="button"
          onClick={() => {
            setState("idle");
            setErrorMessage(null);
          }}
          className="text-sm underline-offset-4 hover:underline"
        >
          {t("contact.submitAnother")}
        </button>
      </div>
    );
  }

  return (
    <>
      {toast && (
        <div
          className="fixed bottom-24 lg:bottom-8 left-1/2 z-50 -translate-x-1/2 rounded-pill bg-foreground text-background px-6 py-3 text-sm shadow-lg"
          role="status"
        >
          {t("contact.toast")}
        </div>
      )}
      <form
        className="contact-page__form w-full space-y-5"
        onSubmit={handleSubmit}
        noValidate={false}
      >
        {errorMessage && (
          <div
            className="rounded-input border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800"
            role="alert"
          >
            {errorMessage}
          </div>
        )}

        <div className="hidden" aria-hidden>
          <label htmlFor="contact-website">Website</label>
          <input
            id="contact-website"
            name="website"
            type="text"
            tabIndex={-1}
            autoComplete="off"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="contact-name" className="sr-only">
              {t("contact.yourName")}
            </label>
            <input
              id="contact-name"
              name="name"
              required
              disabled={state === "submitting"}
              className="w-full border border-border rounded-input px-4 py-3 leading-snug disabled:opacity-60"
              placeholder={t("contact.yourName")}
            />
          </div>
          <div>
            <label htmlFor="contact-email" className="sr-only">
              {t("account.email")}
            </label>
            <input
              id="contact-email"
              name="email"
              type="email"
              required
              disabled={state === "submitting"}
              className="w-full border border-border rounded-input px-4 py-3 leading-snug disabled:opacity-60"
              placeholder={t("contact.workEmail")}
            />
          </div>
        </div>
        <div>
          <label htmlFor="contact-company" className="sr-only">
            {t("contact.companyName")}
          </label>
          <input
            id="contact-company"
            name="company"
            required
            disabled={state === "submitting"}
            className="w-full border border-border rounded-input px-4 py-3 leading-snug disabled:opacity-60"
            placeholder={t("contact.companyName")}
          />
        </div>
        <div>
          <label htmlFor="contact-subject" className="sr-only">
            {t("contact.selectSubject")}
          </label>
          <select
            id="contact-subject"
            name="subject"
            required
            disabled={state === "submitting"}
            className="w-full border border-border rounded-input px-4 py-3 bg-white leading-snug disabled:opacity-60"
            defaultValue=""
          >
            <option value="" disabled>
              {t("contact.selectSubject")}
            </option>
            <option value="wholesale">{t("contact.subjectWholesale")}</option>
            <option value="oem">{t("contact.subjectOem")}</option>
            <option value="samples">{t("contact.subjectSamples")}</option>
            <option value="other">{t("contact.subjectOther")}</option>
          </select>
        </div>
        <div>
          <label htmlFor="contact-message" className="sr-only">
            {t("contact.messagePlaceholder")}
          </label>
          <textarea
            id="contact-message"
            name="message"
            required
            minLength={10}
            disabled={state === "submitting"}
            className="w-full border border-border rounded-input px-4 py-3 min-h-32 leading-snug disabled:opacity-60"
            placeholder={t("contact.messagePlaceholder")}
          />
        </div>

        {showCaptchaHint && (
          <div
            className={cn(
              "rounded-input border border-dashed border-border bg-neutral-50 px-4 py-6 text-center text-sm text-foreground/50"
            )}
            aria-label="hCaptcha placeholder"
          >
            <p className="font-medium text-foreground/70 mb-1">
              {t("contact.hcaptchaTitle")}
            </p>
            <p>{t("contact.hcaptchaNote")}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={state === "submitting"}
          className="rounded-button bg-[rgb(var(--color-base-button))] text-white px-8 py-3 h-[52px] lg:h-auto text-button font-medium hover:opacity-90 transition-opacity disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {state === "submitting"
            ? t("contact.submitting")
            : t("contact.submitInquiry")}
        </button>
      </form>
    </>
  );
}
