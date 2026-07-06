import { buildCartLine } from "../store/cart-line";
import type { CartLine } from "../store/cart";
import type { Product } from "../types/product";

export type WooCartLineInput = Pick<
  CartLine,
  | "wcId"
  | "wcParentId"
  | "wcVariationId"
  | "wcAttributes"
  | "quantity"
  | "sku"
  | "variant"
>;

export type WooCartVariationAttribute = {
  attribute: string;
  value: string;
};

export type WooCartPayload = {
  id: number;
  quantity: number;
  variation?: WooCartVariationAttribute[];
};

export function buildWooCartPayload(line: WooCartLineInput): WooCartPayload {
  const quantity = Math.max(1, Math.floor(Number(line.quantity) || 1));
  const variation =
    line.wcAttributes?.filter((attr) => attr.attribute && attr.value) || [];

  if (variation.length && line.wcParentId) {
    return {
      id: line.wcParentId,
      quantity,
      variation,
    };
  }

  const id = line.wcVariationId || line.wcId;
  if (!id) {
    throw new Error("Cart line is missing WooCommerce product id.");
  }

  return { id, quantity };
}

export function normalizeWooCartLine(
  line: CartLine,
  getProductByHandle: (handle: string) => Product | undefined
): WooCartLineInput {
  const product = getProductByHandle(line.handle);
  if (!product) {
    throw new Error(
      `${line.sku || line.title} is no longer available. Please remove it and add it again.`
    );
  }

  const rebuilt = buildCartLine(product, line.variant || line.sku, line.quantity, line.wcId);
  return {
    wcId: rebuilt.wcId,
    wcParentId: rebuilt.wcParentId,
    wcVariationId: rebuilt.wcVariationId,
    wcAttributes: rebuilt.wcAttributes,
    quantity: rebuilt.quantity,
    sku: rebuilt.sku,
    variant: rebuilt.variant,
  };
}
