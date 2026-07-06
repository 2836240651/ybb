"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchYbbJson } from "@/lib/ybb-rest";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { resolveTriLabel, type TriLabels } from "@/lib/site-manager/labels";

export type ContactPageConfig = {
  salesEmail: string;
  phoneNumber: string;
  companyLegalName: string;
  companyLegalNameZh: string;
  intro: TriLabels;
  hoursDetail: TriLabels;
  syncedAt?: string;
};

const DEFAULT_SALES_EMAIL = "carpybb@gmail.com";

export async function fetchContactPageConfig(): Promise<ContactPageConfig | null> {
  return fetchYbbJson<ContactPageConfig>("/ybb/v1/site-manager/contact");
}

export function useYbbContact() {
  const { t, locale } = useI18n();
  const [remote, setRemote] = useState<ContactPageConfig | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetchContactPageConfig().then((data) => {
      if (cancelled) return;
      if (data) setRemote(data);
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const config = useMemo(
    () => ({
      salesEmail: remote?.salesEmail?.trim() || DEFAULT_SALES_EMAIL,
      phoneNumber: remote?.phoneNumber?.trim() || t("contact.phoneNumber"),
      companyLegalName:
        remote?.companyLegalName?.trim() || t("contact.companyLegalName"),
      companyLegalNameZh:
        remote?.companyLegalNameZh?.trim() || t("contact.companyLegalNameZh"),
      intro: resolveTriLabel(remote?.intro, locale, t("contact.intro")),
      hoursDetail: resolveTriLabel(
        remote?.hoursDetail,
        locale,
        t("contact.hoursDetail")
      ),
    }),
    [locale, remote, t]
  );

  return { config, ready };
}
