import test from "node:test";
import assert from "node:assert/strict";

import {
  composeProofOfPayable,
  escrowedAgentWork,
  policyApprovedPayable,
  verifyProof
} from "../src/index.js";

test("composeProofOfPayable builds valid lifecycle proofs", () => {
  const proof = composeProofOfPayable({
    status: "escrowed",
    id: escrowedAgentWork.id,
    payer: escrowedAgentWork.payer,
    payee: escrowedAgentWork.payee,
    terms: escrowedAgentWork.terms,
    intent: escrowedAgentWork.intent,
    policy: escrowedAgentWork.policy,
    escrow: escrowedAgentWork.escrow,
    createdAt: escrowedAgentWork.createdAt,
    updatedAt: escrowedAgentWork.updatedAt
  });

  assert.equal(proof.status, "escrowed");
  assert.equal(verifyProof(proof).ok, true);
});

test("composeProofOfPayable rejects missing lifecycle evidence", () => {
  assert.throws(() => composeProofOfPayable({
    status: "policy_approved",
    id: policyApprovedPayable.id,
    payer: policyApprovedPayable.payer,
    payee: policyApprovedPayable.payee,
    terms: policyApprovedPayable.terms,
    intent: policyApprovedPayable.intent,
    policy: undefined as never
  }), /Invalid proof/);
});
