import test from "node:test";
import assert from "node:assert/strict";

import { localizeAdditionalInfoRow } from "./additional-info-i18n.mjs";

test("localizes common WooCommerce additional info labels", () => {
  assert.deepEqual(
    localizeAdditionalInfoRow({ key: "weight", label: "Weight", value: "56g" }, "zh"),
    { key: "weight", label: "重量", value: "56g" }
  );
  assert.deepEqual(
    localizeAdditionalInfoRow({ key: "pa_size", label: "Size", value: "blue, red" }, "ja"),
    { key: "pa_size", label: "サイズ", value: "ブルー, レッド" }
  );
});
