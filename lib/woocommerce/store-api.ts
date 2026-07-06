"use client";

import {
  buildWooCartPayload,
  normalizeWooCartLine,
  type WooCartLineInput,
} from "@/lib/woocommerce/cart-payload";
import {
  isWpCustomerLoggedIn,
  wooAccountLoginUrl,
} from "@/lib/woocommerce/auth";
import { getProductByHandle } from "@/lib/data/products";
import type { CartLine } from "@/lib/store/cart";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://carp-ybb.com";
let storeNonce: string | null = null;
let cartToken: string | null = null;
const FALLBACK_CHECKOUT_URL = `${SITE}/checkout/`;

function storeApiUrl(path: string) {
  const route = path.startsWith("/wp-json") ? path.replace(/^\/wp-json/, "") : path;
  const base = `${SITE.replace(/\/$/, "")}/index.php`;
  return `${base}?${new URLSearchParams({ rest_route: route }).toString()}`;
}

function captureStoreHeaders(headers: Headers) {
  const nextNonce = headers.get("Nonce");
  const nextCartToken = headers.get("Cart-Token");
  if (nextNonce) storeNonce = nextNonce;
  if (nextCartToken) cartToken = nextCartToken;
}

async function storeFetch(path: string, init?: RequestInit) {
  const res = await fetch(storeApiUrl(path), {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(storeNonce ? { Nonce: storeNonce } : {}),
      ...(cartToken ? { "Cart-Token": cartToken } : {}),
      ...(init?.headers || {}),
    },
  });
  captureStoreHeaders(res.headers);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${path} HTTP ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

function classifyStoreError(rawError: unknown): string {
  const message = rawError instanceof Error ? rawError.message : String(rawError);
  if (message.includes("HTTP 401")) {
    return "Checkout session expired. Please refresh and try again.";
  }
  if (message.includes("woocommerce_rest_cart_invalid_product")) {
    return "This product option is outdated. Refresh the page, re-select the variant, and try checkout again.";
  }
  if (message.includes("HTTP 5")) {
    return "Checkout service is temporarily unavailable. Please retry in a moment.";
  }
  if (
    message.toLowerCase().includes("failed to fetch") ||
    message.toLowerCase().includes("network")
  ) {
    return "Network error while syncing cart. Please check connection and retry.";
  }
  return `Checkout sync failed: ${message}`;
}

function isMissingAttributesError(rawError: unknown): boolean {
  const message = rawError instanceof Error ? rawError.message : String(rawError);
  return message.includes("woocommerce_rest_missing_attributes");
}

function isInvalidProductError(rawError: unknown): boolean {
  const message = rawError instanceof Error ? rawError.message : String(rawError);
  return message.includes("woocommerce_rest_cart_invalid_product");
}

function variationAttributesFromStoreProduct(product: unknown) {
  const variations = (product as { variations?: Array<{ attributes?: unknown }> })?.variations;
  const first = Array.isArray(variations) ? variations[0] : undefined;
  const attrs = first?.attributes;
  if (!Array.isArray(attrs)) return [];
  return attrs
    .map((attr) => {
      const row = attr as { name?: unknown; attribute?: unknown; value?: unknown; option?: unknown };
      return {
        attribute: String(row.name || row.attribute || "").trim(),
        value: String(row.value || row.option || "").trim(),
      };
    })
    .filter((attr) => attr.attribute && attr.value);
}

async function retryAddItemWithWooAttributes(payload: { id: number; quantity: number }) {
  const product = await storeFetch(`/wp-json/wc/store/v1/products/${payload.id}`);
  const variation = variationAttributesFromStoreProduct(product);
  if (!variation.length) return null;
  return storeFetch("/wp-json/wc/store/v1/cart/add-item", {
    method: "POST",
    body: JSON.stringify({ id: payload.id, quantity: payload.quantity, variation }),
  });
}

function variationRowAttributes(variation: unknown) {
  const attrs = (variation as { attributes?: unknown })?.attributes;
  if (!Array.isArray(attrs)) return [];
  return attrs
    .map((attr) => {
      const row = attr as { name?: unknown; attribute?: unknown; value?: unknown; option?: unknown };
      return {
        attribute: String(row.name || row.attribute || "").trim(),
        value: String(row.value || row.option || "").trim(),
      };
    })
    .filter((attr) => attr.attribute && attr.value);
}

function matchStoreVariation(
  variations: unknown[],
  line: Pick<WooCartLineInput, "wcAttributes" | "variant" | "sku">
) {
  const spec = String(line.variant || "").trim();
  const sku = String(line.sku || "").trim();

  if (line.wcAttributes?.length) {
    for (const variation of variations) {
      const attrs = variationRowAttributes(variation);
      const matches = line.wcAttributes.every((wanted) =>
        attrs.some(
          (attr) =>
            attr.attribute === wanted.attribute && attr.value === wanted.value
        )
      );
      if (matches) return variation;
    }
  }

  for (const variation of variations) {
    const row = variation as { sku?: unknown };
    if (sku && String(row.sku || "") === sku) return variation;
  }

  for (const variation of variations) {
    const attrs = variationRowAttributes(variation);
    const values = attrs.map((attr) => attr.value);
    if (spec && values.includes(spec)) return variation;
    const joined = values.join(" / ");
    if (spec && joined === spec) return variation;
  }

  if (sku) {
    const suffix = sku.split("-").pop() || "";
    for (const variation of variations) {
      const attrs = variationRowAttributes(variation);
      if (attrs.some((attr) => attr.value === suffix)) return variation;
    }
  }

  return undefined;
}

async function retryAddItemWithResolvedVariation(
  line: WooCartLineInput,
  payload: { id: number; quantity: number }
) {
  const parentId = line.wcParentId;
  if (!parentId) return null;

  const product = await storeFetch(`/wp-json/wc/store/v1/products/${parentId}`);
  const variations = (product as { variations?: unknown[] })?.variations;
  if (!Array.isArray(variations) || variations.length === 0) return null;

  const matched = matchStoreVariation(variations, line);
  if (!matched) return null;

  const attrs = variationRowAttributes(matched);
  if (attrs.length) {
    return storeFetch("/wp-json/wc/store/v1/cart/add-item", {
      method: "POST",
      body: JSON.stringify({
        id: parentId,
        quantity: payload.quantity,
        variation: attrs,
      }),
    });
  }

  const variationId = Number((matched as { id?: unknown }).id);
  if (!Number.isFinite(variationId) || variationId < 1) return null;
  return storeFetch("/wp-json/wc/store/v1/cart/add-item", {
    method: "POST",
    body: JSON.stringify({ id: variationId, quantity: payload.quantity }),
  });
}

async function postAddItemToWooCart(
  line: WooCartLineInput,
  payload: ReturnType<typeof buildWooCartPayload>
) {
  try {
    return await storeFetch("/wp-json/wc/store/v1/cart/add-item", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  } catch (err) {
    if (isMissingAttributesError(err) && !payload.variation?.length) {
      const retried = await retryAddItemWithWooAttributes(payload);
      if (retried) return retried;
    }
    if (isInvalidProductError(err)) {
      const retried = await retryAddItemWithResolvedVariation(line, payload);
      if (retried) return retried;
    }
    throw err;
  }
}

/** Woo session cart is separate from Next localStorage �� replace it before checkout. */
async function replaceWooCartWithLines(lines: WooCartLineInput[]) {
  const cart = await storeFetch("/wp-json/wc/store/v1/cart");

  for (const coupon of cart?.coupons ?? []) {
    const code = coupon?.code;
    if (typeof code === "string" && code.length > 0) {
      try {
        await storeFetch("/wp-json/wc/store/v1/cart/remove-coupon", {
          method: "POST",
          body: JSON.stringify({ code }),
        });
      } catch {
        // Best effort �� stale coupon codes should not block checkout sync.
      }
    }
  }

  for (const item of cart?.items ?? []) {
    const key = item?.key;
    if (typeof key === "string" && key.length > 0) {
      try {
        await storeFetch("/wp-json/wc/store/v1/cart/remove-item", {
          method: "POST",
          body: JSON.stringify({ key }),
        });
      } catch {
        // Continue clearing remaining rows.
      }
    }
  }

  for (const line of lines) {
    await addItemToWooCart(line);
  }
}

export async function addItemToWooCart(line: WooCartLineInput) {
  const payload = buildWooCartPayload(line);
  try {
    return await postAddItemToWooCart(line, payload);
  } catch (err) {
    // Missing/expired nonce is common on static pages; refresh cart headers once.
    const msg = err instanceof Error ? err.message : String(err);
    if (!msg.includes("HTTP 401")) {
      throw new Error(classifyStoreError(err));
    }
    await storeFetch("/wp-json/wc/store/v1/cart");
    try {
      return await postAddItemToWooCart(line, payload);
    } catch (retryErr) {
      throw new Error(classifyStoreError(retryErr));
    }
  }
}

export async function getCheckoutUrl(): Promise<string> {
  const cart = await storeFetch("/wp-json/wc/store/v1/cart");
  const url = cart?.links?.checkout?.[0]?.href;
  if (typeof url === "string" && url.length > 0) {
    return url.startsWith("http") ? url : `${SITE}${url}`;
  }
  return `${SITE}/checkout/`;
}

export async function syncLinesToWooAndCheckout(lines: CartLine[]) {
  const normalizedLines = lines.map((line) =>
    normalizeWooCartLine(line, getProductByHandle)
  );
  const invalidLines = normalizedLines.filter((line) => !line.wcId || line.quantity < 1);
  if (invalidLines.length > 0) {
    throw new Error(
      "Some cart items are outdated. Please remove and re-add those items before checkout."
    );
  }

  await replaceWooCartWithLines(normalizedLines);

  let checkoutUrl = FALLBACK_CHECKOUT_URL;
  try {
    checkoutUrl = await getCheckoutUrl();
  } catch {
    // keep fallback
  }

  if (!(await isWpCustomerLoggedIn())) {
    window.location.href = wooAccountLoginUrl(checkoutUrl);
    return;
  }

  window.location.href = checkoutUrl;
}
