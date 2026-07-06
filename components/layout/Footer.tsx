"use client";

import { FooterColumns } from "@/components/layout/FooterColumns";
import { FooterPaymentIcons } from "@/components/layout/FooterPaymentIcons";
import { getBrandName } from "@/lib/brand";
import navigation from "@/lib/data/navigation.json";
import { useI18n } from "@/lib/i18n/I18nProvider";

export function Footer() {
  const { t, tl } = useI18n();
  const policyLinks = navigation.footer.policies;

  return (
    <footer className="footer-site">
      <div className="footer-main">
        <div className="page-container page-container-chrome">
          <FooterColumns />
        </div>
      </div>

      <div className="footer-bottom">
        <div className="page-container page-container-chrome footer-bottom-inner">
          <div className="footer-bottom-legal">
            <p className="footer-copyright">
              © {new Date().getFullYear()} {getBrandName()}.{" "}
              {t("footer.allRightsReserved")}
            </p>
            <ul className="footer-policy-list" role="list">
              {policyLinks.map((link) => (
                <li key={link.href}>
                  <a href={link.href} className="footer-policy-link interaction-footer-link">
                    {tl(link.label)}
                  </a>
                </li>
              ))}
            </ul>
          </div>
          <FooterPaymentIcons />
        </div>
      </div>
    </footer>
  );
}
