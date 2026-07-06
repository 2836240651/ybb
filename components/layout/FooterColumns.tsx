"use client";

import { useId, useState } from "react";
import { BrandLogo } from "@/components/layout/BrandLogo";
import { FooterNewsletter } from "@/components/layout/FooterNewsletter";
import { FooterSocialIcons } from "@/components/layout/FooterSocialIcons";
import { useSiteNavigation } from "@/lib/site-manager/NavigationProvider";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { cn } from "@/lib/utils";

function dedupeLinksByHref(links: { label: string; href: string }[]) {
  const seen = new Set<string>();
  return links.filter((link) => {
    if (seen.has(link.href)) return false;
    seen.add(link.href);
    return true;
  });
}

type AccordionSectionProps = {
  title: string;
  children: React.ReactNode;
};

function AccordionSection({ title, children }: AccordionSectionProps) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  return (
    <div className="footer-accordion md:border-0">
      <button
        type="button"
        id={`${panelId}-trigger`}
        className="footer-accordion-trigger md:hidden"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
      >
        {title}
        <span
          className={cn(
            "footer-accordion-icon text-lg leading-none transition-transform duration-300",
            open && "rotate-45"
          )}
          aria-hidden
        >
          +
        </span>
      </button>
      <h2 className="footer-column-heading hidden md:block">{title}</h2>
      <div
        id={panelId}
        role="region"
        aria-labelledby={`${panelId}-trigger`}
        className={cn(
          "footer-accordion-panel grid transition-[grid-template-rows,opacity] duration-300 ease-primary md:block md:opacity-100",
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0 md:opacity-100"
        )}
      >
        <div className="overflow-hidden md:overflow-visible">
          <div className="pb-4 md:pb-0">{children}</div>
        </div>
      </div>
    </div>
  );
}

function FooterLinkList({
  links,
  tl,
}: {
  links: { label: string; href: string }[];
  tl: (label: string) => string;
}) {
  return (
    <ul className="footer-link-list">
      {links.map((link) => (
        <li key={`${link.href}-${link.label}`}>
          <a href={link.href} className="footer-link interaction-footer-link">
            {tl(link.label)}
          </a>
        </li>
      ))}
    </ul>
  );
}

export function FooterColumns() {
  const { t, tl } = useI18n();
  const { footerQuickLinks, ready } = useSiteNavigation();
  const quickLinks = ready ? dedupeLinksByHref(footerQuickLinks) : [];

  return (
    <div className="footer-grid">
      <div className="footer-left">
        <div className="footer-brand-col">
          <BrandLogo
            showText={false}
            layout="stacked"
            className="footer-brand-logo gap-3"
            imageClassName="h-11 w-11"
          />
        </div>
        <div className="footer-links-cluster">
          <AccordionSection title={t("footer.quickLinks")}>
            <FooterLinkList links={quickLinks} tl={tl} />
          </AccordionSection>
        </div>
      </div>

      <div className="footer-right">
        <FooterNewsletter />
        <FooterSocialIcons />
      </div>
    </div>
  );
}
