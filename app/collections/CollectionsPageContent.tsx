"use client";

import Link from "next/link";
import { catalogMainCategories } from "@/lib/data/catalog";
import { collections } from "@/lib/data/products";
import { useCollectionTitle, useI18n } from "@/lib/i18n/I18nProvider";

const CATALOG_HANDLES = new Set([
  ...catalogMainCategories.map((category) => category.handle),
  "other",
  "accessories-metal",
  "accessories-plastic",
  "rod-pod-accessories",
  "peripheral-equipment",
]);

function CollectionListItem({
  handle,
  fallbackTitle,
  description,
}: {
  handle: string;
  fallbackTitle: string;
  description: string;
}) {
  const { t } = useI18n();
  const title = useCollectionTitle(handle, fallbackTitle);

  return (
    <li>
      <article>
        <Link
          href={`/collections/${handle}`}
          className="group block rounded-card border border-border p-5 hover:bg-neutral-50 transition-colors"
        >
          <p className="text-xs uppercase tracking-widest text-foreground/50 mb-2">
            {t("common.collection")}
          </p>
          <h2 className="text-lg font-bold group-hover:opacity-80 transition-opacity">
            {title}
          </h2>
          <p className="mt-2 text-sm text-foreground/60 line-clamp-2">
            {description}
          </p>
          <p className="mt-4 text-sm font-medium">{t("product.viewProducts")}</p>
        </Link>
      </article>
    </li>
  );
}

export function CollectionsPageContent() {
  const { t } = useI18n();
  const catalogCollections = collections.filter((collection) =>
    CATALOG_HANDLES.has(collection.handle)
  );

  return (
    <>
      <div className="page-container py-10 md:py-12">
        <h1 className="text-title-md mb-4">{t("collectionsPage.title")}</h1>
        <p className="opacity-70 mb-10">{t("collectionsPage.intro")}</p>

        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {catalogCollections.map((collection) => (
            <CollectionListItem
              key={collection.handle}
              handle={collection.handle}
              fallbackTitle={collection.title}
              description={collection.description}
            />
          ))}
        </ul>
      </div>
    </>
  );
}
