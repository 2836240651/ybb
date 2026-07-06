import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ProductReviewsSection } from "@/components/product/ProductReviewsSection";
import {
  getCollectionByHandle,
  getProductByHandle,
  products,
} from "@/lib/data/products";

type Props = {
  params: Promise<{ handle: string }>;
};

export function generateStaticParams() {
  const params = products.map((product) => ({ handle: product.handle }));
  return params.length > 0 ? params : [{ handle: "__empty-catalog__" }];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { handle } = await params;
  const product = getProductByHandle(handle);
  if (!product) return { title: "Reviews" };
  return {
    title: `${product.title} — Reviews`,
    description: `Customer reviews for ${product.title}.`,
  };
}

export default async function ProductReviewsPage({ params }: Props) {
  const { handle } = await params;
  if (handle === "__empty-catalog__") notFound();
  const product = getProductByHandle(handle);
  if (!product) notFound();

  const collection = getCollectionByHandle(product.collection);

  return (
    <ProductReviewsSection
      product={product}
      collectionTitle={collection?.title}
    />
  );
}
