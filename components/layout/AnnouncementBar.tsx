"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import announcements from "@/lib/data/announcements.json";
import navigation from "@/lib/data/navigation.json";
import { useYbbAnnouncements } from "@/lib/site-manager/announcements-api";
import { useSiteNavigation } from "@/lib/site-manager/NavigationProvider";
import { resolveTriLabel } from "@/lib/site-manager/labels";
import { FacebookIcon, SOCIAL_ICONS } from "@/components/layout/SocialIcons";
import {
  COUNTRY_OPTIONS,
  readStoredCountry,
  storeCountry,
  type CountryOption,
} from "@/lib/i18n/country";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { LOCALES, localeLabels, type Locale } from "@/lib/i18n/locales";
import { cn } from "@/lib/utils";

const MARQUEE_DURATION_S = 40;

function GlobeIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      className={className}
      aria-hidden
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" />
    </svg>
  );
}

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 10 6" fill="currentColor" className={className} aria-hidden>
      <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" fill="none" />
    </svg>
  );
}

export function AnnouncementBar() {
  const staticItems = announcements.items.map((item) => ({
    id: item.id,
    href: item.href,
  }));
  const { items, enabled, ready } = useYbbAnnouncements(staticItems);
  const { footerSocial } = useSiteNavigation();
  const socialLinks = footerSocial ?? navigation.footer.social;
  const { locale, setLocale, t, localeLabel } = useI18n();
  const [paused, setPaused] = useState(false);
  const [localeOpen, setLocaleOpen] = useState(false);
  const [countryOpen, setCountryOpen] = useState(false);
  const [country, setCountry] = useState<CountryOption>(COUNTRY_OPTIONS[0]);
  const localeRef = useRef<HTMLDivElement>(null);
  const countryRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setCountry(readStoredCountry());
  }, []);

  const closeDropdowns = useCallback(() => {
    setLocaleOpen(false);
    setCountryOpen(false);
  }, []);

  useEffect(() => {
    if (!localeOpen && !countryOpen) return;

    const onDocumentClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (localeOpen && localeRef.current && !localeRef.current.contains(target)) {
        setLocaleOpen(false);
      }
      if (countryOpen && countryRef.current && !countryRef.current.contains(target)) {
        setCountryOpen(false);
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeDropdowns();
    };

    // Defer so the opening click does not immediately hit the outside listener
    const timer = window.setTimeout(() => {
      document.addEventListener("click", onDocumentClick, true);
    }, 0);

    document.addEventListener("keydown", onKeyDown);

    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("click", onDocumentClick, true);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [localeOpen, countryOpen, closeDropdowns]);

  const selectLocale = (code: Locale) => {
    setLocale(code);
    setLocaleOpen(false);
  };

  const selectCountry = (opt: CountryOption) => {
    setCountry(opt);
    storeCountry(opt.id);
    setCountryOpen(false);
  };

  const marqueeItems = [...items, ...items];

  if (ready && !enabled) return null;
  if (ready && !items.length) return null;

  return (
    <div
      className="announcement-bar"
      role="region"
      aria-label={t("common.announcements")}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="page-container announcement-bar__inner">
        <div className="announcement-bar__marquee" aria-live="off">
          <div
            className={cn(
              "announcement-marquee-track",
              paused && "announcement-marquee-paused"
            )}
            style={{ "--announcement-marquee-duration": `${MARQUEE_DURATION_S}s` } as CSSProperties}
          >
            {marqueeItems.map((item, i) => (
              <a
                key={`${item.id}-${i}`}
                href={item.href}
                className="announcement-marquee-item"
                aria-hidden={i >= items.length}
                tabIndex={i >= items.length ? -1 : undefined}
              >
                {resolveTriLabel(item.labels, locale, t(`announcements.${item.id}`))}
              </a>
            ))}
          </div>
        </div>

        <div className="announcement-bar__utilities">
          <ul className="announcement-social-list" role="list">
            {socialLinks.map((item) => {
              const Icon = SOCIAL_ICONS[item.label] ?? FacebookIcon;
              return (
                <li key={item.href}>
                  <a
                    href={item.href}
                    className="announcement-social-link"
                    aria-label={item.label}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Icon className="h-5 w-5" />
                  </a>
                </li>
              );
            })}
          </ul>

          <div className="announcement-locale" ref={localeRef}>
            <button
              type="button"
              className="announcement-utility-btn"
              aria-expanded={localeOpen}
              aria-haspopup="listbox"
              aria-label={t("common.language")}
              onClick={(e) => {
                e.stopPropagation();
                setCountryOpen(false);
                setLocaleOpen((o) => !o);
              }}
            >
              <GlobeIcon className="h-4 w-4 shrink-0" />
              <span>{localeLabel}</span>
              <ChevronIcon className="h-2 w-2 opacity-60 shrink-0" />
            </button>
            {localeOpen && (
              <ul
                role="listbox"
                aria-label={t("common.selectLanguage")}
                className="announcement-dropdown"
              >
                {LOCALES.map((code) => (
                  <li key={code} role="option" aria-selected={locale === code}>
                    <button
                      type="button"
                      className={cn(
                        "announcement-dropdown__item",
                        locale === code && "announcement-dropdown__item--active"
                      )}
                      onClick={(e) => {
                        e.stopPropagation();
                        selectLocale(code);
                      }}
                    >
                      {localeLabels[code]}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="announcement-country" ref={countryRef}>
            <button
              type="button"
              className="announcement-utility-btn"
              aria-expanded={countryOpen}
              aria-haspopup="listbox"
              aria-label={`${country.label} ${country.currency}`}
              onClick={(e) => {
                e.stopPropagation();
                setLocaleOpen(false);
                setCountryOpen((o) => !o);
              }}
            >
              <span className="text-base leading-none" aria-hidden>
                {country.flag}
              </span>
              <span className="announcement-country-label">
                {country.label} {country.currency} {country.symbol}
              </span>
              <ChevronIcon className="h-2 w-2 opacity-60 shrink-0" />
            </button>
            {countryOpen && (
              <ul role="listbox" className="announcement-dropdown announcement-dropdown--wide">
                {COUNTRY_OPTIONS.map((opt) => (
                  <li key={opt.id} role="option" aria-selected={country.id === opt.id}>
                    <button
                      type="button"
                      className={cn(
                        "announcement-dropdown__item",
                        country.id === opt.id && "announcement-dropdown__item--active"
                      )}
                      onClick={(e) => {
                        e.stopPropagation();
                        selectCountry(opt);
                      }}
                    >
                      <span aria-hidden>{opt.flag}</span>
                      <span>
                        {opt.label} {opt.currency} {opt.symbol}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
