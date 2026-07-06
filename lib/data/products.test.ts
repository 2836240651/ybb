import test from "node:test";
import assert from "node:assert/strict";

import {
  getProductByHandle,
  getProductGalleryImages,
} from "./products.ts";

test("does not resolve removed benchmark alias handles", () => {
  assert.equal(getProductByHandle("black-pearl-carp-rods"), undefined);
  assert.equal(getProductByHandle("three-way-swivel-kit-box"), undefined);
});

test("uses synced WooCommerce images without fabricating gallery entries", () => {
  const product = getProductByHandle("carp-new-magnetic-hooklink-box-a128b");
  assert.ok(product);
  assert.deepEqual(getProductGalleryImages(product), product.images);
  assert.equal(product.images.length, 1);
});
