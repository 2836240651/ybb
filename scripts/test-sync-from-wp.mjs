import assert from "node:assert/strict";
import {
  normalizeCollectionSlug,
  selectFrontendCollection,
} from "./sync-from-wp.mjs";

assert.equal(normalizeCollectionSlug("carp-fishing-leads"), "sinkers");
assert.equal(normalizeCollectionSlug("inline-tube-insert-lead"), "sinkers");
assert.equal(normalizeCollectionSlug("carp-fishing-rigs"), "rigs");
assert.equal(normalizeCollectionSlug("bait-cage-rigs"), "bait-cage-rigs");
assert.equal(normalizeCollectionSlug("accessories-metal"), "accessories-metal");
assert.equal(normalizeCollectionSlug("bait-cages--small-core"), "bait-cages");

assert.equal(
  selectFrontendCollection(["other", "peripheral-equipment", "peripheral-equipment--tool-kit"]),
  "peripheral-equipment"
);
assert.equal(
  selectFrontendCollection(["sinkers--dg", "carp-fishing-leads"]),
  "sinkers"
);
assert.equal(selectFrontendCollection(["inline-tube-insert-lead"]), "sinkers");
assert.equal(selectFrontendCollection(["carp-fishing-rigs"]), "rigs");

console.log("sync-from-wp slug normalization tests passed");
