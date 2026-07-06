import type { Product, ProductVariant } from "@/lib/types/product";

type WooAttribute = {
  attribute: string;
  value: string;
};

export type BuiltCartLine = {
  handle: string;
  title: string;
  titleCn: string;
  price: number;
  image: string;
  variant: string;
  sku: string;
  wcId?: number;
  wcParentId?: number;
  wcVariationId?: number;
  wcAttributes?: WooAttribute[];
  quantity: number;
};

function getProductVariants(product: Product): ProductVariant[] {
  if (product.variants?.length) return product.variants;
  if (!product.sku && !product.spec) return [];
  return [
    {
      sku: product.sku || product.handle,
      spec: product.spec || "Default",
      price: product.price,
      compareAtPrice: product.compareAtPrice,
      available: product.available,
      wcId: product.wcId,
      images: product.images,
    },
  ];
}

function getVariant(product: Product, specOrSku?: string): ProductVariant | undefined {
  const variants = getProductVariants(product);
  if (!variants.length) return undefined;
  if (!specOrSku) {
    return (
      variants.find((variant) => variant.sku === product.defaultVariantSku) ||
      variants[0]
    );
  }
  return (
    variants.find((variant) => variant.spec === specOrSku || variant.sku === specOrSku) ||
    variants[0]
  );
}

export function findProductVariant(
  product: Product,
  specOrSku?: string,
  wcId?: number
): ProductVariant | undefined {
  const variants = getProductVariants(product);
  if (!variants.length) return undefined;
  if (typeof wcId === "number" && wcId > 0) {
    const byWcId = variants.find((variant) => variant.wcId === wcId);
    if (byWcId) return byWcId;
  }
  return getVariant(product, specOrSku);
}

export function sanitizeCartQuantity(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) return 1;
  return Math.floor(parsed);
}

export function buildCartLine(
  product: Product,
  variant = "Default",
  quantity = 1,
  wcId?: number
): BuiltCartLine {
  const selected = findProductVariant(product, variant, wcId);
  const wcAttributes =
    selected?.wcAttributes?.filter((attr) => attr.attribute && attr.value) || [];
  const isVariable = product.productType === "variable" && Boolean(product.wcId);
  const lineWcId = selected?.wcId ?? product.wcId;
  const lineImage =
    selected?.images?.[0] ??
    product.images[0] ??
    "/images/placeholder-product.jpg";

  return {
    handle: product.handle,
    title: product.title,
    titleCn: product.titleCn ?? "",
    price: selected?.price ?? product.price,
    image: lineImage,
    variant: selected?.spec || variant,
    sku: selected?.sku ?? product.sku ?? product.titleCn ?? "",
    wcId: lineWcId,
    wcParentId: isVariable ? product.wcId : undefined,
    wcVariationId: isVariable && selected?.wcId ? selected.wcId : undefined,
    wcAttributes: wcAttributes.length ? wcAttributes : undefined,
    quantity: sanitizeCartQuantity(quantity),
  };
}
