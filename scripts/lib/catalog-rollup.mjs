/** Shared collection rollup helpers for sync-from-wp and tooling. */

export const OTHER_CHILD_HANDLES = [
  "accessories-metal",
  "accessories-plastic",
  "rod-pod-accessories",
  "peripheral-equipment",
];

/** Longest-prefix first — TZ-QZDZ before TZ-QZ. */
export const SKU_PREFIX_COLLECTION_RULES = [
  ["TZ-QZDZ-", "sinker-rigs"],
  ["TZ-ELDZ-", "bait-cage-rigs"],
  ["TZ-EL-", "bait-cages"],
  ["TZ-QZ-", "sinkers"],
  ["TZ-XZ-", "rigs"],
  ["TZ-HK-", "carp-hooks"],
  ["TZ-ZJ-", "rod-pod-accessories"],
  ["TZ-PJSL-", "accessories-plastic"],
  ["TZ-ZBSB-", "peripheral-equipment"],
  ["TZ-XP-", "peripheral-equipment"],
];

export function collectionFromSkuPrefix(parentSku, allowedHandles = null) {
  const sku = String(parentSku || "").toUpperCase();
  for (const [prefix, handle] of SKU_PREFIX_COLLECTION_RULES) {
    if (!sku.startsWith(prefix)) continue;
    if (allowedHandles && !allowedHandles.has(handle)) continue;
    return handle;
  }
  return null;
}

export function loadNavCollectionRollups(nav) {
  const rollups = {};
  for (const item of nav?.primaryNav || []) {
    const match = String(item?.href || "").match(/^\/collections\/([^/?#]+)/);
    if (!match || !item?.megaMenu?.children?.length) continue;
    const parent = match[1];
    const childHandles = item.megaMenu.children
      .map((child) =>
        String(child?.href || "").match(/^\/collections\/([^/?#]+)/)?.[1]
      )
      .filter(Boolean);
    rollups[parent] = new Set([parent, ...childHandles]);
  }
  return rollups;
}

export function productHandlesForCollection(handle, products, navRollups = {}) {
  if (handle === "all") {
    return products.map((product) => product.handle);
  }
  if (handle === "other") {
    return products
      .filter((product) => OTHER_CHILD_HANDLES.includes(product.collection))
      .map((product) => product.handle);
  }
  const rollup = navRollups[handle];
  if (rollup) {
    return products
      .filter((product) => rollup.has(product.collection))
      .map((product) => product.handle);
  }
  return products
    .filter((product) => product.collection === handle)
    .map((product) => product.handle);
}
