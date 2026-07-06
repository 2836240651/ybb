import test from "node:test";
import assert from "node:assert/strict";

import { getProductByHandle } from "./products.ts";
import { resolveProductGallery } from "../woocommerce/product-gallery.ts";

test("uses Woo live gallery as baseline when ready", () => {
  const product = getProductByHandle("tz-hk-001");
  assert.ok(product);

  const resolved = resolveProductGallery(
    product,
    {
      enabled: true,
      layout: "bottom-strip",
      defaultIndex: 0,
      images: [
        "https://carp-ybb.com/wp-content/uploads/a.png",
        "https://carp-ybb.com/wp-content/uploads/b.png",
      ],
      hideIndexes: [],
      source: "woo",
      wooImages: [
        "https://carp-ybb.com/wp-content/uploads/a.png",
        "https://carp-ybb.com/wp-content/uploads/b.png",
      ],
    },
    [
      "https://carp-ybb.com/wp-content/uploads/a.png",
      "https://carp-ybb.com/wp-content/uploads/b.png",
    ],
    undefined,
    true
  );

  assert.equal(resolved.source, "woo");
  assert.equal(resolved.images.length, 2);
  assert.equal(resolved.enabled, true);
});

test("falls back to static only before live is ready", () => {
  const product = getProductByHandle("tz-hk-001");
  assert.ok(product);

  const resolved = resolveProductGallery(product, undefined, undefined, undefined, false);
  assert.equal(resolved.source, "static");
  assert.equal(resolved.images.length, product.images.length);
});

test("marks override source when Site Manager URL list is active", () => {
  const product = getProductByHandle("tz-hk-001");
  assert.ok(product);

  const resolved = resolveProductGallery(
    product,
    {
      enabled: true,
      layout: "bottom-strip",
      defaultIndex: 1,
      images: ["https://example.com/override-1.png", "https://example.com/override-2.png"],
      hideIndexes: [],
      source: "override",
      overrideImages: ["https://example.com/override-1.png", "https://example.com/override-2.png"],
      wooImages: ["https://carp-ybb.com/wp-content/uploads/a.png"],
    },
    ["https://carp-ybb.com/wp-content/uploads/a.png"],
    undefined,
    true
  );

  assert.equal(resolved.source, "override");
  assert.equal(resolved.defaultIndex, 1);
  assert.equal(resolved.images[0], "https://example.com/override-1.png");
});
