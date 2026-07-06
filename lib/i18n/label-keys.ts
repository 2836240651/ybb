/** Convert English UI label to a stable dictionary key segment. */
export function labelToKey(label: string): string {
  return label
    .toLowerCase()
    .replace(/\s*&\s*/g, "-")
    .replace(/\s*\/\s*/g, "-")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function labelDictKey(label: string): string {
  return `labels.${labelToKey(label)}`;
}
