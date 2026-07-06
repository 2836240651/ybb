"use client";

import { useEffect } from "react";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { cn } from "@/lib/utils";

type WriteReviewModalProps = {
  open: boolean;
  onClose: () => void;
  onSubmitted?: () => void;
  embedUrl: string | null;
  productTitle: string;
};

export function WriteReviewModal({
  open,
  onClose,
  onSubmitted,
  embedUrl,
  productTitle,
}: WriteReviewModalProps) {
  const { t } = useI18n();

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === "ybb-review-submitted") {
        onSubmitted?.();
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [open, onSubmitted]);

  if (!open || !embedUrl) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center p-0 sm:items-center sm:p-4" role="presentation">
      <div
        className="absolute inset-0 bg-[rgb(23_23_23/0.72)]"
        aria-hidden
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t("product.writeReview")}
        className={cn(
          "relative z-[1] flex w-full max-h-[100dvh] max-w-2xl flex-col overflow-hidden",
          "rounded-none bg-white shadow-2xl sm:max-h-[90vh] sm:rounded-card"
        )}
      >
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-border px-4 py-3 sm:gap-4 sm:px-5 sm:py-4 md:px-6">
          <div className="min-w-0 flex-1 space-y-1">
            <p className="text-xs uppercase tracking-[0.18em] text-foreground/45">
              {t("product.writeReview")}
            </p>
            <h2 className="break-words text-base font-semibold leading-snug md:text-lg">{productTitle}</h2>
            <p className="text-xs text-foreground/55">{t("product.reviewsManagedByWoo")}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full interaction-icon-hover"
            aria-label={t("common.close")}
          >
            <span aria-hidden>�?/span>
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto bg-neutral-50">
          <iframe
            title={t("product.writeReview")}
            src={embedUrl}
            className="h-[min(72dvh,640px)] w-full max-w-full border-0 bg-white sm:h-[min(70vh,640px)]"
            loading="lazy"
          />
        </div>
      </div>
    </div>
  );
}
