/** WP page slug (URL) ?local JSON source for legal / info pages. */

export type LegalRouteMeta =
  | { kind: "policy"; handle: string }
  | { kind: "page"; handle: string };

export const LEGAL_WP_SLUGS: Record<string, LegalRouteMeta> = {
  shipping: { kind: "policy", handle: "shipping" },
  privacy: { kind: "policy", handle: "privacy" },
  terms: { kind: "policy", handle: "terms" },
  refund_returns: { kind: "policy", handle: "refund" },
  samples: { kind: "page", handle: "samples" },
  "moq-lead-time": { kind: "page", handle: "moq-lead-time" },
};

export const LEGAL_WP_SLUG_LIST = Object.keys(LEGAL_WP_SLUGS);
