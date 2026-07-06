import test from "node:test";
import assert from "node:assert/strict";

import {
  applyLiveSummaryToProduct,
  filterProductsForCatalog,
  mergeProductWithLive,
} from "./product-live-merge.ts";
import type { Product } from "../types/product.ts";

const base = {
  handle: "tz-xp-038",
  title: "Test",
  price: 1.99,
  images: ["/x.jpg"],
  collection: "2026-new-products",
  available: true,
  tags: [],
  wcId: 50886,
} satisfies Product;

test("filterProductsForCatalog hides frontHidden when overrides ready", () => {
  const visible = filterProductsForCatalog(
    [base],
    { "tz-xp-038": { frontHidden: true } },
    true
  );
  assert.equal(visible.length, 0);
});

test("mergeProductWithLive replaces stale static images", () => {
  const merged = mergeProductWithLive(base, {
    handle: "tz-xp-038",
    wcId: 50886,
    titles: { en: "Test", zh: "", ja: "" },
    price: 1.99,
    available: true,
    variants: [],
    images: ["https://carp-ybb.com/wp-content/uploads/2026/07/new-hook.png"],
  });
  assert.deepEqual(merged.images, [
    "https://carp-ybb.com/wp-content/uploads/2026/07/new-hook.png",
  ]);
});

test("applyLiveSummaryToProduct updates list price", () => {
  const merged = applyLiveSummaryToProduct(base, {
    wcId: 50886,
    price: 2.49,
    available: true,
  });
  assert.equal(merged.price, 2.49);
});
