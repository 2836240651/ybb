import test from "node:test";
import assert from "node:assert/strict";

import {
  buildClassicWooCartPayload,
  buildWooCartPayload,
  normalizeWooCartLine,
} from "./cart-payload.ts";
import type { Product } from "../types/product.ts";

const products = [
  {
    handle: "tz-el-089",
    title: "Carp Method Feeder - J103",
    titleEn: "Carp Method Feeder - J103",
    titleZh: "Carp Method Feeder - J103",
    titleJa: "Carp Method Feeder - J103",
    price: 1.99,
    images: ["https://carp-ybb.com/wp-content/uploads/2026/06/TZ-EL-089.png"],
    collection: "sinkers",
    available: true,
    tags: [],
    sku: "TZ-EL-089",
    wcId: 49760,
    productType: "variable",
    variants: [
      {
        sku: "TZ-EL-089-M-green",
        spec: "M-green",
        price: 1.99,
        available: true,
        wcId: 49767,
        wcAttributes: [{ attribute: "Specification", value: "M-green" }],
      },
    ],
  },
] satisfies Product[];

const getProductByHandle = (handle: string) =>
  products.find((product) => product.handle === handle);

test("builds Store API payload with parent id and variation attributes", () => {
  assert.deepEqual(
    buildWooCartPayload({
      wcId: 49764,
      wcParentId: 49764,
      wcVariationId: 49788,
      wcAttributes: [{ attribute: "Specification", value: "S-yellow" }],
      quantity: 2,
    }),
    {
      id: 49764,
      quantity: 2,
      variation: [{ attribute: "Specification", value: "S-yellow" }],
    }
  );
});

test("builds classic Woo AJAX payload for variable products", () => {
  assert.equal(
    buildClassicWooCartPayload({
      wcId: 49809,
      wcParentId: 49800,
      wcVariationId: 49809,
      wcAttributes: [{ attribute: "Specification", value: "TZ-EL-098" }],
      quantity: 3,
    }).toString(),
    "add-to-cart=49800&product_id=49800&variation_id=49809&quantity=3&attribute_specification=TZ-EL-098"
  );
});

test("builds classic Woo AJAX payload for simple products", () => {
  assert.equal(
    buildClassicWooCartPayload({
      wcId: 51275,
      quantity: 2,
    }).toString(),
    "add-to-cart=51275&product_id=51275&quantity=2"
  );
});

test("falls back to simple product id when no variation attributes exist", () => {
  assert.deepEqual(
    buildWooCartPayload({
      wcId: 51275,
      wcVariationId: 51275,
      quantity: 1,
    }),
    { id: 51275, quantity: 1 }
  );
});

test("normalizes persisted variable cart lines before building Store API payload", () => {
  const line = normalizeWooCartLine(
    {
      handle: "tz-el-089",
      title: "Carp Method Feeder - J103",
      titleCn: "Carp Method Feeder - J103",
      price: 1.99,
      image: "",
      variant: "M-green",
      sku: "TZ-EL-089-M-green",
      wcId: 49767,
      quantity: 1,
    },
    getProductByHandle
  );

  assert.deepEqual(buildWooCartPayload(line), {
    id: 49760,
    quantity: 1,
    variation: [{ attribute: "Specification", value: "M-green" }],
  });
});

test("rejects stale cart lines that no longer exist in the current catalog", () => {
  assert.throws(
    () =>
      normalizeWooCartLine({
        handle: "tz-qz-025",
        title: "Sinkers - Aircraft Lead",
        titleCn: "飞机铅坠",
        price: 1.99,
        image: "",
        variant: "100g",
        sku: "TZ-QZ-025-100g",
        wcId: 49249,
        quantity: 1,
      }, getProductByHandle),
    /no longer available/
  );
});
