import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ProductDetail } from "@/components/product/ProductDetail";
import { JsonLd } from "@/components/seo/JsonLd";
import {
  getCollectionByHandle,
  getProductByHandle,
  products,
} from "@/lib/data/products";
import { breadcrumbJsonLd, productJsonLd } from "@/lib/seo";

type Props = {
  params: Promise<{ handle: string }>;
};

export function generateStaticParams() {
  const params = products.map((product) => ({ handle: product.handle }));
  // Next static export requires at least one param for dynamic routes.
  return params.length > 0 ? params : [{ handle: "__empty-catalog__" }];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { handle } = await params;
  const product = getProductByHandle(handle);
  if (!product) return { title: "Product" };
  return {
    title: product.title,
    description: `${product.title} — ${product.titleCn}. Wholesale from YBB Tackle factory.`,
  };
}

export default async function ProductPage({ params }: Props) {
  const { handle } = await params;
  if (handle === "__empty-catalog__") notFound();
  const product = getProductByHandle(handle);
  if (!product) notFound();

  const collection = getCollectionByHandle(product.collection);

  const breadcrumbs = breadcrumbJsonLd([
    { name: "Home", path: "/" },
    ...(collection
      ? [
          {
            name: collection.title,
            path: `/collections/${collection.handle}`,
          },
        ]
      : []),
    { name: product.title, path: `/products/${handle}.html` },
  ]);

  return (
    <>
      <JsonLd data={[productJsonLd(product), breadcrumbs]} />
      <ProductDetail
        product={product}
        collectionTitle={collection?.title}
      />
    </>
  );
}
