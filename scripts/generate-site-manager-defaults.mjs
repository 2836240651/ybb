#!/usr/bin/env node
/**
 * Generates ybb-site-manager/includes/defaults-data.json from navigation.json + i18n.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const nav = JSON.parse(
  fs.readFileSync(path.join(ROOT, "lib/data/navigation.json"), "utf8")
);
const en = JSON.parse(
  fs.readFileSync(path.join(ROOT, "lib/i18n/dictionaries/en.json"), "utf8")
);
const zh = JSON.parse(
  fs.readFileSync(path.join(ROOT, "lib/i18n/dictionaries/zh.json"), "utf8")
);
const ja = JSON.parse(
  fs.readFileSync(path.join(ROOT, "lib/i18n/dictionaries/ja.json"), "utf8")
);

function triFromKey(key) {
  return {
    en: en.labels?.[key] ?? en.announcements?.[key] ?? key,
    zh: zh.labels?.[key] ?? zh.announcements?.[key] ?? key,
    ja: ja.labels?.[key] ?? ja.announcements?.[key] ?? key,
  };
}

function triFromText(text) {
  return { en: text, zh: text, ja: text };
}

function labelKeyFromEn(label) {
  const map = {
    "2026 New Products": "2026-new-products",
    Sinkers: "sinkers",
    "Bait Cages": "bait-cages",
    Rigs: "rigs",
    "Sinker Rigs": "sinker-rigs",
    "Bait Cage Rigs": "bait-cage-rigs",
    "Carp Hooks": "carp-hooks",
    "Euro Carp Kits": "euro-carp-kits",
    Other: "other",
    "OEM / ODM": "oem-odm",
    "Private Label": "private-label",
    "Custom Packaging": "custom-packaging",
    "MOQ & Lead Time": "moq-lead-time",
    "View OEM / ODM Overview": "view-oem-odm-overview",
    "Wholesale RFQ": "wholesale-rfq",
    "Fishing Articles & Videos": "fishing-articles-videos",
    "Shipping Policy": "shipping-policy",
    "Sample Policy": "sample-policy",
    "Terms & Conditions": "terms-conditions",
    "Privacy Policy": "privacy-policy",
    Contact: "contact",
    "Catalog Download": "catalog-download",
    "Returns & Refund Policy": "refund-policy",
    "Terms of service": "terms-of-service",
  };
  return map[label] ?? null;
}

function navLink(item, idPrefix) {
  const key = labelKeyFromEn(item.label);
  const labels = key ? triFromKey(key) : triFromText(item.label);
  const out = {
    id: `${idPrefix}-${sanitizeId(item.label)}`,
    label: item.label,
    labels,
    href: item.href,
    enabled: true,
  };
  if (item.megaMenu) {
    out.megaMenu = {
      variant: item.megaMenu.variant ?? "default",
      children: item.megaMenu.children.map((c, i) => {
        const ck = labelKeyFromEn(c.label);
        return {
          label: c.label,
          labels: ck ? triFromKey(ck) : triFromText(c.label),
          href: c.href,
          featuredProducts: c.featuredProducts ?? [],
        };
      }),
      shopAll: {
        label: item.megaMenu.shopAll.label,
        labels: labelKeyFromEn(item.megaMenu.shopAll.label)
          ? triFromKey(labelKeyFromEn(item.megaMenu.shopAll.label))
          : triFromText(item.megaMenu.shopAll.label),
        href: item.megaMenu.shopAll.href,
      },
    };
  }
  return out;
}

function sanitizeId(s) {
  return String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

const announcements = JSON.parse(
  fs.readFileSync(path.join(ROOT, "lib/data/announcements.json"), "utf8")
);

const heroSlides = [
  { id: "factory-catalog", href: "/pages/wholesale", imageUrl: "/images/hero/hero-01.webp" },
  { id: "ready-rigs", href: "/collections/all", imageUrl: "/images/hero/hero-02.webp" },
  { id: "bait-cages", href: "/pages/oem-odm", imageUrl: "/images/hero/hero-03.webp" },
  { id: "oem", href: "/pages/contact", imageUrl: "/images/hero/hero-04.webp" },
];

const defaults = {
  navigation: {
    primaryNav: nav.primaryNav.map((item, i) => navLink(item, `nav-${i}`)),
    footer: {
      quickLinks: nav.footer.quickLinks.map((item, i) => navLink(item, `fq-${i}`)),
      information: nav.footer.information.map((item, i) => navLink(item, `fi-${i}`)),
      policies: nav.footer.policies.map((item, i) => navLink(item, `fp-${i}`)),
      social: nav.footer.social.map((item, i) => ({
        id: `social-${i}`,
        label: item.label,
        labels: triFromText(item.label),
        href: item.href,
        enabled: true,
      })),
    },
  },
  announcements: {
    enabled: true,
    items: announcements.items.map((item) => ({
      id: item.id,
      labels: {
        en: en.announcements[item.id] ?? item.text,
        zh: zh.announcements[item.id] ?? item.text,
        ja: ja.announcements[item.id] ?? item.text,
      },
      href: item.href,
      enabled: true,
    })),
  },
  hero: {
    enabled: true,
    autoplayMs: 7000,
    slides: heroSlides.map((slide) => ({
      id: slide.id,
      href: slide.href,
      imageUrl: slide.imageUrl,
      labels: {
        en: en.hero[slide.id]?.title ?? slide.id,
        zh: zh.hero[slide.id]?.title ?? slide.id,
        ja: ja.hero[slide.id]?.title ?? slide.id,
      },
      enabled: true,
    })),
  },
  video: {
    enabled: true,
    videoUrl: "/videos/factory-showcase.mp4",
    posterUrl: "",
    labels: {
      title: {
        en: "30+ Years of Terminal Tackle Manufacturing",
        zh: "30+ 年终端钓具制造经验",
        ja: "30年以上のターミナルタックル製造",
      },
      body: {
        en: "Tour our production floor — sinkers, rigs, bait cages, and OEM programs built for global brands.",
        zh: "走进生产车间——铅坠、钓组、饵笼，以及面向全球品牌的 OEM 定制生产线。",
        ja: "生産現場をご案内——シンカー、リグ、餌籠、そして世界のブランド向けOEMプログラム。",
      },
      cta: {
        en: "Request a factory visit",
        zh: "预约工厂参观",
        ja: "工場見学を申し込む",
      },
    },
  },
  featured: {
    enabled: true,
    handle: "three-way-swivel-kit-box",
  },
  brand: {
    name: "YBB",
    tagline: {
      en: "Trusted Tackle Partner",
      zh: "值得信赖的渔具合作伙伴",
      ja: "信頼できるタックルパートナー",
    },
    logoAlt: "YBB",
    logoPath: "/images/brand/ybb-logo.png",
  },
  deploy: {
    secret: "",
    state: "idle",
    pending: false,
    pendingUntil: null,
    lastBuildId: "",
    lastError: "",
    startedAt: null,
    finishedAt: null,
    trigger: "",
  },
};

const outPath = path.join(
  ROOT,
  "deploy/wp-content/mu-plugins/ybb-site-manager/includes/defaults-data.json"
);
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(defaults, null, 2) + "\n");
console.log("Wrote", outPath);
