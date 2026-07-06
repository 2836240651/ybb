/** Node-side mirror of lib/i18n/variant-spec.ts for sync scripts. */

import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const SPEC_DICT = JSON.parse(
  readFileSync(join(root, "lib/data/variant-spec-i18n.json"), "utf8")
);

const HAN_RE = /[\u4e00-\u9fff]/;

function isAsciiSpec(text) {
  return Boolean(text) && !HAN_RE.test(text);
}

export function enrichVariantSpecI18n(variant, catalogSpec) {
  const spec = String(variant.spec || catalogSpec || "").trim() || "Default";
  const dict = SPEC_DICT[spec];
  if (dict) {
    return { ...variant, spec, specEn: dict.en, specZh: dict.zh, specJa: dict.ja };
  }
  if (isAsciiSpec(spec)) {
    return { ...variant, spec, specEn: spec, specZh: spec, specJa: spec };
  }
  return { ...variant, spec, specZh: spec, specEn: spec, specJa: spec };
}
