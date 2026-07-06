import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { CatalogCategoryShell } from "@/components/catalog/CatalogCategoryShell";
import { CollectionPageClient } from "@/components/product/CollectionPageClient";
import { JsonLd } from "@/components/seo/JsonLd";
import {
  collections,
  getCollectionByHandle,
  getProductsByCollection,
} from "@/lib/data/products";
import { breadcrumbJsonLd, collectionJsonLd } from "@/lib/seo";

type Props = {
  params: Promise<{ handle: string }>;
};

export function generateStaticParams() {
  return collections.map((c) => ({ handle: c.handle }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { handle } = await params;
  const collection = getCollectionByHandle(handle);
  if (!collection) return { title: "Collection" };
  return {
    title: collection.title,
    description: collection.description,
  };
}

export default async function CollectionPage({ params }: Props) {
  const { handle } = await params;
  const collection = getCollectionByHandle(handle);
  if (!collection) notFound();

  const products = getProductsByCollection(handle);

  const breadcrumbs = breadcrumbJsonLd([
    { name: "Home", path: "/" },
    { name: "Collections", path: "/collections" },
    { name: collection.title, path: `/collections/${handle}` },
  ]);

  return (
    <>
      <JsonLd
        data={[
          collectionJsonLd(
            collection.title,
            collection.handle,
            collection.description
          ),
          breadcrumbs,
        ]}
      />
      <CatalogCategoryShell activeHandle={handle}>
        <CollectionPageClient
          key={handle}
          collection={collection}
          products={products}
        />
      </CatalogCategoryShell>
    </>
  );
}
