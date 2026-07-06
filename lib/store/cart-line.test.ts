import test from "node:test";
import assert from "node:assert/strict";

import { buildCartLine } from "./cart-line.ts";
import type { Product } from "@/lib/types/product";

const variableProduct = {
  handle: "tz-el-093",
  title: "Bait Screw",
  titleEn: "Bait Screw",
  titleZh: "饵料螺丝",
  titleJa: "Bait Screw",
  titleCn: "饵料螺丝",
  price: 1.2,
  images: ["https://carp-ybb.com/wp-content/uploads/2026/06/TZ-EL-093.png"],
  collection: "bait-cage-rigs",
  available: true,
  tags: [],
  sku: "TZ-EL-093",
  wcId: 49764,
  productType: "variable",
  variants: [
    {
      sku: "TZ-EL-093-S-YELLOW",
      spec: "S-yellow",
      price: 1.5,
      available: true,
      wcId: 49788,
      wcAttributes: [{ attribute: "Specification", value: "S-yellow" }],
    },
  ],
} satisfies Product;

test("buildCartLine preserves Woo variable-product parent id and attributes", () => {
  assert.deepEqual(buildCartLine(variableProduct, "S-yellow", 2), {
    handle: "tz-el-093",
    title: "Bait Screw",
    titleCn: "饵料螺丝",
    price: 1.5,
    image: "https://carp-ybb.com/wp-content/uploads/2026/06/TZ-EL-093.png",
    variant: "S-yellow",
    sku: "TZ-EL-093-S-YELLOW",
    wcId: 49788,
    wcParentId: 49764,
    wcVariationId: 49788,
    wcAttributes: [{ attribute: "Specification", value: "S-yellow" }],
    quantity: 2,
  });
});

const variableWithoutAttrs = {
  ...variableProduct,
  handle: "tz-xp-038",
  sku: "TZ-XP-038",
  wcId: 50886,
  variants: [
    {
      sku: "TZ-XP-038-橙色",
      spec: "橙色",
      price: 1.99,
      available: true,
      wcId: 48494,
    },
  ],
} satisfies Product;

test("buildCartLine keeps parent id for variable products missing wcAttributes", () => {
  const line = buildCartLine(variableWithoutAttrs, "橙色", 1);
  assert.equal(line.wcParentId, 50886);
  assert.equal(line.wcVariationId, 48494);
  assert.equal(line.wcAttributes, undefined);
});
