/** Canonical variant SKU rules (mirror scripts/sku_normalize.py). */

export function cleanText(value) {
  if (value == null) return "";
  return String(value)
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, " ");
}

export function sanitizeSpecForSku(spec) {
  let text = cleanText(spec);
  if (!text) return "default";
  text = text
    .replace(/&#10;/gi, "")
    .replace(/[\n\r]/g, "")
    .replace(/\//g, "-")
    .replace(/\\/g, "-")
    .replace(/\*/g, "");
  text = text.replace(/\s+/g, " ").trim();
  text = text.replace(/[^\w\-+#./]+/gu, "-").replace(/^-+|-+$/g, "");
  return text || "default";
}

export function canonicalVariantSku(parentSku, spec) {
  const parent = cleanText(parentSku);
  return `${parent}-${sanitizeSpecForSku(spec)}`;
}
