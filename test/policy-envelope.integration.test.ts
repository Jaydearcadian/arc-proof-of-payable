import test from "node:test";
import assert from "node:assert/strict";

import {
  allowedRequest,
  deniedRequest,
  demoEnvelope,
  evaluateEnvelope
} from "../../arc-policy-envelope/src/index.js";
import {
  assessFinanceability,
  composeProofOfPayable,
  hashBytes,
  verifyProof
} from "../src/index.js";
import type { PolicyRef } from "../src/index.js";

const policyRefFromEvaluation = (
  evaluation: ReturnType<typeof evaluateEnvelope>,
  request: typeof allowedRequest
): PolicyRef | undefined => {
  if (evaluation.status !== "allowed") return undefined;
  return {
    envelopeId: evaluation.envelopeId,
    policyHash: evaluation.policyHash,
    approvalHash: evaluation.approvalHash,
    approval: {
      version: evaluation.version,
      status: evaluation.status,
      requestId: evaluation.requestId,
      requestHash: evaluation.requestHash,
      evaluatedAt: evaluation.evaluatedAt,
      reasons: evaluation.reasons,
        request,
        envelope: demoEnvelope
    }
  };
};

test("policy envelope approval composes into a verifiable ProofOfPayable", () => {
  const evaluation = evaluateEnvelope(demoEnvelope, allowedRequest);
  assert.equal(evaluation.status, "allowed");

  const policy = policyRefFromEvaluation(evaluation, allowedRequest);
  assert.ok(policy);

  const proof = composeProofOfPayable({
    status: "policy_approved",
    id: "pop_policy_envelope_integration_001",
    payer: { kind: "organization", id: "org_microcosm_demo" },
    payee: { kind: "agent", id: allowedRequest.actorId },
    terms: {
      amount: allowedRequest.amount,
      asset: allowedRequest.asset,
      network: allowedRequest.network,
      reason: "Market agent bankroll request"
    },
    intent: {
      intentId: allowedRequest.id,
      intentHash: evaluation.requestHash
    },
    policy,
    createdAt: evaluation.evaluatedAt,
    updatedAt: evaluation.evaluatedAt
  });

  assert.equal(proof.status, "policy_approved");
  assert.deepEqual(proof.policy, policy);
  assert.equal(verifyProof(proof).ok, true);
  assert.equal(assessFinanceability(proof).financeable, true);
  assert.equal(assessFinanceability(proof).risk, "high");
});

test("denied policy envelope evaluation does not produce a PolicyRef", () => {
  const evaluation = evaluateEnvelope(demoEnvelope, deniedRequest);

  assert.equal(evaluation.status, "denied");
  assert.equal("approvalHash" in evaluation, false);
  assert.equal(policyRefFromEvaluation(evaluation, deniedRequest), undefined);
  assert.ok(evaluation.reasons.length > 0);
});

test("denied policy evidence cannot be recast as an approval", () => {
  const evaluation = evaluateEnvelope(demoEnvelope, deniedRequest);
  assert.equal(evaluation.status, "denied");

  assert.throws(() => composeProofOfPayable({
    status: "policy_approved",
    id: "pop_policy_envelope_denied_001",
    payer: { kind: "organization", id: "org_microcosm_demo" },
    payee: { kind: "agent", id: deniedRequest.actorId },
    terms: {
      amount: deniedRequest.amount,
      asset: deniedRequest.asset,
      network: deniedRequest.network,
      reason: deniedRequest.reason
    },
    intent: {
      intentId: deniedRequest.id,
      intentHash: evaluation.requestHash
    },
    policy: {
      envelopeId: evaluation.envelopeId,
      policyHash: evaluation.policyHash,
      approvalHash: evaluation.denialHash,
      approval: {
        version: evaluation.version,
        status: "allowed",
        requestId: evaluation.requestId,
        requestHash: evaluation.requestHash,
        evaluatedAt: evaluation.evaluatedAt,
        reasons: ["All envelope rules passed."],
        request: deniedRequest,
        envelope: demoEnvelope
      }
    },
    createdAt: evaluation.evaluatedAt,
    updatedAt: evaluation.evaluatedAt
  }), /policy\.approvalHash|not allowed by envelope/);
});

test("denied policy request cannot self-forge allowed approval evidence", () => {
  const evaluation = evaluateEnvelope(demoEnvelope, deniedRequest, "2026-05-23T12:00:01.000Z");
  assert.equal(evaluation.status, "denied");
  const forgedApprovalHash = hashBytes({
    type: "policy.approval.v1",
    version: "evaluation.v1",
    envelopeId: evaluation.envelopeId,
    requestId: evaluation.requestId,
    policyHash: evaluation.policyHash,
    requestHash: evaluation.requestHash,
    evaluatedAt: evaluation.evaluatedAt,
    status: "allowed",
    reasons: ["All envelope rules passed."]
  });

  assert.throws(() => composeProofOfPayable({
    status: "policy_approved",
    id: "pop_policy_envelope_forged_001",
    payer: { kind: "organization", id: deniedRequest.payerId },
    payee: { kind: "agent", id: deniedRequest.actorId },
    terms: {
      amount: deniedRequest.amount,
      asset: deniedRequest.asset,
      network: deniedRequest.network,
      reason: deniedRequest.reason
    },
    intent: {
      intentId: deniedRequest.id,
      intentHash: evaluation.requestHash
    },
    policy: {
      envelopeId: evaluation.envelopeId,
      policyHash: evaluation.policyHash,
      approvalHash: forgedApprovalHash,
      approval: {
        version: evaluation.version,
        status: "allowed",
        requestId: evaluation.requestId,
        requestHash: evaluation.requestHash,
        evaluatedAt: evaluation.evaluatedAt,
        reasons: ["All envelope rules passed."],
        request: deniedRequest,
        envelope: demoEnvelope
      }
    },
    createdAt: evaluation.evaluatedAt,
    updatedAt: evaluation.evaluatedAt
  }), /not allowed by envelope/);
});

test("policy approval cannot be replayed onto different payable terms", () => {
  const evaluation = evaluateEnvelope(demoEnvelope, allowedRequest);
  assert.equal(evaluation.status, "allowed");
  const policy = policyRefFromEvaluation(evaluation, allowedRequest);
  assert.ok(policy);

  assert.throws(() => composeProofOfPayable({
    status: "policy_approved",
    id: "pop_policy_envelope_replay_001",
    payer: { kind: "organization", id: "org_microcosm_demo" },
    payee: { kind: "agent", id: allowedRequest.actorId },
    terms: {
      amount: "24.00",
      asset: allowedRequest.asset,
      network: allowedRequest.network,
      reason: allowedRequest.reason
    },
    intent: {
      intentId: allowedRequest.id,
      intentHash: evaluation.requestHash
    },
    policy,
    createdAt: evaluation.evaluatedAt,
    updatedAt: evaluation.evaluatedAt
  }), /terms\.amount must match policy\.approval\.request\.amount/);

  assert.throws(() => composeProofOfPayable({
    status: "policy_approved",
    id: "pop_policy_envelope_replay_002",
    payer: { kind: "organization", id: "org_microcosm_demo" },
    payee: { kind: "agent", id: allowedRequest.actorId },
    terms: {
      amount: allowedRequest.amount,
      asset: allowedRequest.asset,
      network: allowedRequest.network,
      reason: allowedRequest.reason
    },
    intent: {
      intentId: "req_other_agent_request",
      intentHash: evaluation.requestHash
    },
    policy,
    createdAt: evaluation.evaluatedAt,
    updatedAt: evaluation.evaluatedAt
  }), /intent\.intentId must match policy\.approval\.request\.id/);

  assert.throws(() => composeProofOfPayable({
    status: "policy_approved",
    id: "pop_policy_envelope_replay_003",
    payer: { kind: "organization", id: "org_microcosm_demo" },
    payee: { kind: "agent", id: allowedRequest.actorId },
    terms: {
      amount: allowedRequest.amount,
      asset: allowedRequest.asset,
      network: allowedRequest.network,
      reason: "Different payable reason"
    },
    intent: {
      intentId: allowedRequest.id,
      intentHash: evaluation.requestHash
    },
    policy,
    createdAt: evaluation.evaluatedAt,
    updatedAt: evaluation.evaluatedAt
  }), /terms\.reason must match policy\.approval\.request\.reason/);

  assert.throws(() => composeProofOfPayable({
    status: "policy_approved",
    id: "pop_policy_envelope_replay_004",
    payer: { kind: "organization", id: "org_other" },
    payee: { kind: "agent", id: allowedRequest.actorId },
    terms: {
      amount: allowedRequest.amount,
      asset: allowedRequest.asset,
      network: allowedRequest.network,
      reason: allowedRequest.reason
    },
    intent: {
      intentId: allowedRequest.id,
      intentHash: evaluation.requestHash
    },
    policy,
    createdAt: evaluation.evaluatedAt,
    updatedAt: evaluation.evaluatedAt
  }), /payer\.id must match policy\.approval\.request\.payerId/);

  assert.throws(() => composeProofOfPayable({
    status: "policy_approved",
    id: "pop_policy_envelope_replay_005",
    payer: { kind: "organization", id: allowedRequest.payerId },
    payee: { kind: "wallet", id: "attacker_wallet" },
    terms: {
      amount: allowedRequest.amount,
      asset: allowedRequest.asset,
      network: allowedRequest.network,
      reason: allowedRequest.reason
    },
    intent: {
      intentId: allowedRequest.id,
      intentHash: evaluation.requestHash
    },
    policy,
    createdAt: evaluation.evaluatedAt,
    updatedAt: evaluation.evaluatedAt
  }), /payee\.kind must be agent|payee\.id must match/);
});
