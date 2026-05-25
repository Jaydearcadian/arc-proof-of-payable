import test from "node:test";
import assert from "node:assert/strict";

import {
  assessFinanceability,
  escrowedAgentWork,
  policyApprovedPayable,
  proposedPayable,
  rejectedPayable,
  settledPayable
} from "../src/index.js";

test("escrowed payable is low-risk financeable", () => {
  assert.deepEqual(assessFinanceability(escrowedAgentWork), {
    financeable: true,
    risk: "low",
    reasons: ["Structurally financeable: payable is escrowed with policy evidence and an escrow transaction hash. Verify the source system and Arc transaction before underwriting."]
  });
});

test("policy-approved payable is high-risk financeable", () => {
  assert.equal(assessFinanceability(policyApprovedPayable).financeable, true);
  assert.equal(assessFinanceability(policyApprovedPayable).risk, "high");
});

test("proposed, settled, and rejected payables are ineligible", () => {
  assert.equal(assessFinanceability(proposedPayable).financeable, false);
  assert.equal(assessFinanceability(settledPayable).financeable, false);
  assert.equal(assessFinanceability(rejectedPayable).financeable, false);
});
