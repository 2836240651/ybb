"use client";

import type { Collection } from "@/lib/types/product";
import { ScrollReveal } from "@/components/motion/ScrollReveal";
import { useCollectionTitle, useI18n } from "@/lib/i18n/I18nProvider";

type CollectionPageHeaderProps = {
  collection: Collection;
  productCount: number;
};

export function CollectionPageHeader({
  collection,
  productCount,
}: CollectionPageHeaderProps) {
  const { t } = useI18n();
  const title = useCollectionTitle(collection.handle, collection.title);

  return (
    <>
      <h1 className="sr-only text-title-md">{title}</h1>
      <header className="mb-8 md:mb-10 lg:mb-14 max-w-3xl">
        <ScrollReveal animate="fade-up">
          <p className="text-sm uppercase tracking-widest text-foreground/50 mb-2">
            {t("common.ybbWholesale")}
          </p>
        </ScrollReveal>
        <ScrollReveal animate="fade-up-large" delay={60}>
          <h2 className="text-title-md mb-3">{title}</h2>
        </ScrollReveal>
        <ScrollReveal animate="fade-up" delay={120}>
          <p className="mt-4 text-sm text-foreground/60 leading-relaxed">
            {collection.description}
          </p>
        </ScrollReveal>
        <ScrollReveal animate="fade-up" delay={180}>
          <p className="mt-2 text-xs text-foreground/50">
            {t("common.skusMoq", { count: productCount })}
          </p>
        </ScrollReveal>
      </header>
    </>
  );
}
