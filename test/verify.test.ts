import test from "node:test";
import assert from "node:assert/strict";

import {
  escrowedAgentWork,
  hashProof,
  policyApprovedPayable,
  proposedPayable,
  rejectedPayable,
  settledPayable,
  validateProof,
  verifyProof
} from "../src/index.js";

test("valid examples verify", () => {
  for (const proof of [proposedPayable, policyApprovedPayable, escrowedAgentWork, settledPayable, rejectedPayable]) {
    assert.deepEqual(validateProof(proof), []);
    assert.equal(verifyProof(proof).ok, true);
  }
});

test("lifecycle-specific evidence is required", () => {
  const invalid = { ...settledPayable, settlement: undefined };
  assert.match(validateProof(invalid).join("\n"), /settlement/);
});

test("verifyProof returns errors instead of throwing for undefined lifecycle evidence", () => {
  const invalid = { ...settledPayable, settlement: undefined };
  const result = verifyProof(invalid as never);
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /settlement/);
});

test("lifecycle-inappropriate evidence is rejected", () => {
  const invalid = { ...proposedPayable, settlement: settledPayable.settlement };
  assert.match(validateProof(invalid).join("\n"), /proof\.settlement is not allowed/);
});

test("unknown extra fields are rejected", () => {
  const invalid = { ...proposedPayable, uncommittedDirective: undefined };
  const errors = validateProof(invalid).join("\n");
  assert.match(errors, /proof\.uncommittedDirective is not allowed/);
  assert.match(errors, /proof\.uncommittedDirective must not be undefined/);
});

test("zero amount is rejected", () => {
  const invalid = {
    ...escrowedAgentWork,
    terms: { ...escrowedAgentWork.terms, amount: "0" }
  };
  assert.match(validateProof(invalid).join("\n"), /terms\.amount/);
});

test("expected hash detects tampering", () => {
  const expectedHash = hashProof(escrowedAgentWork);
  const tampered = {
    ...escrowedAgentWork,
    terms: { ...escrowedAgentWork.terms, amount: "1000.00" }
  };
  const result = verifyProof(tampered, expectedHash);
  assert.equal(result.ok, false);
  assert.match(result.errors.join("\n"), /proof hash does not match/);
});
