import { DEFAULT_LOCALE } from "@/lib/i18n/locales";
import { translate } from "@/lib/i18n/translate";
import type { OemOverviewHandle } from "@/lib/data/oem-pages";

const ADVANTAGE_KEYS = ["item1", "item2", "item3", "item4", "item5"] as const;
const MOQ_KEYS = ["item1", "item2", "item3"] as const;

type OemPageContentProps = {
  handle: OemOverviewHandle;
};

function titleKeyForHandle(handle: OemOverviewHandle): string {
  switch (handle) {
    case "private-label":
      return "oemPrivateLabel.title";
    case "custom-packaging":
      return "oemCustomPackaging.title";
    case "moq-lead-time":
      return "oemMoqLeadTime.title";
    default:
      return "oemOverview.title";
  }
}

function OemOverviewSections({ t }: { t: (key: string) => string }) {
  return (
    <>
      <section className="policy-page__section oem-overview-page__section">
        <h2 className="policy-page__section-title oem-overview-page__heading mb-4">
          {t("oemOverview.odm.heading")}
        </h2>
        <div className="policy-page__section-body oem-overview-page__text space-y-4">
          <p>{t("oemOverview.odm.p1")}</p>
          <p>{t("oemOverview.odm.p2")}</p>
          <p>
            <strong>{t("oemOverview.keyBenefits")}</strong>{" "}
            {t("oemOverview.odm.benefits")}
          </p>
        </div>
      </section>

      <section className="policy-page__section oem-overview-page__section">
        <h2 className="policy-page__section-title oem-overview-page__heading mb-4">
          {t("oemOverview.oem.heading")}
        </h2>
        <div className="policy-page__section-body oem-overview-page__text space-y-4">
          <p>{t("oemOverview.oem.p1")}</p>
          <p>{t("oemOverview.oem.p2")}</p>
          <p>
            <strong>{t("oemOverview.keyBenefits")}</strong>{" "}
            {t("oemOverview.oem.benefits")}
          </p>
        </div>
      </section>

      <section className="policy-page__section oem-overview-page__section">
        <h2 className="policy-page__section-title oem-overview-page__heading mb-4">
          {t("oemOverview.advantages.heading")}
        </h2>
        <ol className="policy-page__section-body oem-overview-page__list space-y-3 text-left max-w-2xl mx-auto">
          {ADVANTAGE_KEYS.map((key) => (
            <li key={key}>{t(`oemOverview.advantages.${key}`)}</li>
          ))}
        </ol>
      </section>
    </>
  );
}

function OemSubPageBody({
  handle,
  t,
}: {
  handle: OemOverviewHandle;
  t: (key: string) => string;
}) {
  if (handle === "private-label") {
    return (
      <div className="policy-page__section-body oem-overview-page__text space-y-4">
        <p>{t("oemPrivateLabel.p1")}</p>
        <p>{t("oemPrivateLabel.p2")}</p>
        <p>{t("oemPrivateLabel.p3")}</p>
      </div>
    );
  }

  if (handle === "custom-packaging") {
    return (
      <div className="policy-page__section-body oem-overview-page__text space-y-4">
        <p>{t("oemCustomPackaging.p1")}</p>
        <p>{t("oemCustomPackaging.p2")}</p>
        <p>{t("oemCustomPackaging.p3")}</p>
      </div>
    );
  }

  if (handle === "moq-lead-time") {
    return (
      <ol className="policy-page__section-body oem-overview-page__list space-y-4 text-left max-w-2xl mx-auto">
        {MOQ_KEYS.map((key) => (
          <li key={key}>{t(`oemMoqLeadTime.${key}`)}</li>
        ))}
      </ol>
    );
  }

  return null;
}

/** Server-rendered OEM pages �?copy is baked into static HTML (no client hydration swap). */
export function OemPageContent({ handle }: OemPageContentProps) {
  const t = (key: string) => translate(DEFAULT_LOCALE, key);
  const isOverview = handle === "oem-odm";

  return (
    <article className="oem-overview-page policy-page page-container py-12 md:py-16 lg:py-20">
      <header className="policy-page__header mb-10 md:mb-14">
        <h1 className="policy-page__title mb-6">{t(titleKeyForHandle(handle))}</h1>
      </header>

      <div className="oem-overview-page__body policy-page__body space-y-12 md:space-y-16">
        {isOverview ? (
          <OemOverviewSections t={t} />
        ) : (
          <OemSubPageBody handle={handle} t={t} />
        )}
      </div>
    </article>
  );
}

/** @deprecated Use OemPageContent with handle="oem-odm" */
export function OemOdmOverviewContent() {
  return <OemPageContent handle="oem-odm" />;
}
