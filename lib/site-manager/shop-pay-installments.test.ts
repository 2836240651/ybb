import test from "node:test";
import assert from "node:assert/strict";

import {
  clampInstallmentCount,
  interpolateInstallmentTemplate,
} from "./shop-pay-installment-template.ts";

test("interpolateInstallmentTemplate replaces placeholders", () => {
  const out = interpolateInstallmentTemplate("Pay {count} x {amount} total {total}", {
    amount: "$0.16",
    count: 3,
    total: "$0.49",
  });
  assert.equal(out, "Pay 3 x $0.16 total $0.49");
});

test("clampInstallmentCount bounds 2-12", () => {
  assert.equal(clampInstallmentCount(1), 2);
  assert.equal(clampInstallmentCount(3), 3);
  assert.equal(clampInstallmentCount(99), 12);
});
