import test from "node:test";
import assert from "node:assert/strict";

import {
  allowedRequest,
  deniedRequest,
  demoEnvelope,
  evaluateEnvelope
} from "../../arc-policy-envelope/src/index.js";
import type { EvaluationRequest } from "../../arc-policy-envelope/src/index.js";
import {
  assessFinanceability,
  composeProofOfPayable,
  verifyProof
} from "../src/index.js";
import type { PolicyRef, ProofOfPayable } from "../src/index.js";

type EconomicOrder = {
  id: string;
  issuerId: string;
  agentId: string;
  objective: string;
  maxAmount: string;
  asset: EvaluationRequest["asset"];
  network: EvaluationRequest["network"];
  allowedVenueId: string;
  reason: string;
};

type MarketAction = {
  id: string;
  orderId: string;
  actorId: string;
  venueId: string;
  amount: string;
  reason: string;
  expectedEdgeBps: number;
};

type AgentRun = {
  order: EconomicOrder;
  request: EvaluationRequest;
  evaluation: ReturnType<typeof evaluateEnvelope>;
  policy?: PolicyRef;
  action?: MarketAction;
  proof?: ProofOfPayable;
};

type Review = {
  reviewer: string;
  ok: boolean;
  reason: string;
};

const order: EconomicOrder = {
  id: "order_market_bankroll_001",
  issuerId: "org_microcosm_demo",
  agentId: "agent_market_researcher",
  objective: "Find bounded Arc market opportunities without exceeding the bankroll envelope.",
  maxAmount: "25.00",
  asset: "USDC",
  network: "arc-testnet",
  allowedVenueId: "venue_prediction_market_demo",
  reason: "Market agent bankroll request"
};

const parseAmount = (amount: string): bigint => {
  const [whole, fraction = ""] = amount.split(".");
  return BigInt(whole) * 1_000_000n + BigInt(fraction.padEnd(6, "0"));
};

const policyRefFromEvaluation = (
  evaluation: ReturnType<typeof evaluateEnvelope>,
  request: EvaluationRequest
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

const runPrimaryAgent = (input: EconomicOrder, request: EvaluationRequest): AgentRun => {
  const evaluation = evaluateEnvelope(demoEnvelope, request, "2026-05-23T12:00:01.000Z");
  const policy = policyRefFromEvaluation(evaluation, request);
  if (!policy) return { order: input, request, evaluation };

  const action: MarketAction = {
    id: `action_${request.id}`,
    orderId: input.id,
    actorId: request.actorId,
    venueId: request.target.kind === "venue" ? request.target.venueId : "",
    amount: request.amount,
    reason: request.reason,
    expectedEdgeBps: 18
  };

  const proof = composeProofOfPayable({
    status: "policy_approved",
    id: `pop_${request.id}`,
    payer: { kind: "organization", id: input.issuerId },
    payee: { kind: "agent", id: request.actorId },
    terms: {
      amount: request.amount,
      asset: request.asset,
      network: request.network,
      reason: request.reason
    },
    intent: {
      intentId: request.id,
      intentHash: evaluation.requestHash
    },
    policy,
    createdAt: evaluation.evaluatedAt,
    updatedAt: evaluation.evaluatedAt
  });

  return { order: input, request, evaluation, policy, action, proof };
};

const policyReviewer = (run: AgentRun): Review => {
  if (run.evaluation.status !== "allowed") {
    return { reviewer: "policy", ok: false, reason: run.evaluation.reasons.join("; ") };
  }
  if (!run.policy) return { reviewer: "policy", ok: false, reason: "missing policy ref" };
  if (run.request.payerId !== run.order.issuerId) return { reviewer: "policy", ok: false, reason: "wrong payer" };
  if (run.request.actorId !== run.order.agentId) return { reviewer: "policy", ok: false, reason: "wrong agent" };
  if (run.request.asset !== run.order.asset || run.request.network !== run.order.network) {
    return { reviewer: "policy", ok: false, reason: "wrong asset or network" };
  }
  if (parseAmount(run.request.amount) > parseAmount(run.order.maxAmount)) {
    return { reviewer: "policy", ok: false, reason: "request exceeds order budget" };
  }
  if (run.request.target.kind !== "venue" || run.request.target.venueId !== run.order.allowedVenueId) {
    return { reviewer: "policy", ok: false, reason: "wrong venue" };
  }
  if (run.request.reason !== run.order.reason) return { reviewer: "policy", ok: false, reason: "wrong reason" };
  return { reviewer: "policy", ok: true, reason: "policy evaluation matches order" };
};

const proofReviewer = (run: AgentRun): Review => {
  if (!run.proof) return { reviewer: "proof", ok: false, reason: "missing proof" };
  const verification = verifyProof(run.proof);
  if (!verification.ok) return { reviewer: "proof", ok: false, reason: verification.errors.join("; ") };
  const financeability = assessFinanceability(run.proof);
  if (!financeability.financeable) return { reviewer: "proof", ok: false, reason: financeability.reasons.join("; ") };
  return { reviewer: "proof", ok: true, reason: "proof verifies and is structurally financeable" };
};

const actionReviewer = (run: AgentRun): Review => {
  if (!run.action) return { reviewer: "action", ok: false, reason: "missing action intent" };
  if (!run.proof || !verifyProof(run.proof).ok) return { reviewer: "action", ok: false, reason: "proof is not verifiable" };
  if (run.proof.payer.id !== run.order.issuerId) return { reviewer: "action", ok: false, reason: "proof references wrong payer" };
  if (run.proof.payee.id !== run.order.agentId) return { reviewer: "action", ok: false, reason: "proof references wrong payee" };
  if (run.action.orderId !== run.order.id) return { reviewer: "action", ok: false, reason: "action references wrong order" };
  if (run.action.actorId !== run.request.actorId) return { reviewer: "action", ok: false, reason: "action references wrong actor" };
  if (run.action.venueId !== run.order.allowedVenueId) return { reviewer: "action", ok: false, reason: "action references wrong venue" };
  if (run.action.amount !== run.request.amount) return { reviewer: "action", ok: false, reason: "action amount differs from request" };
  if (run.action.reason !== run.request.reason) return { reviewer: "action", ok: false, reason: "action reason differs from request" };
  return { reviewer: "action", ok: true, reason: "action intent stayed inside approved request" };
};

const reviewBoard = (
  run: AgentRun,
  extraReviewers: Array<(run: AgentRun) => Review> = []
) => {
  const reviewers = [policyReviewer, proofReviewer, actionReviewer, ...extraReviewers];
  const reviews = reviewers.map((reviewer) => reviewer(run));
  const approvals = reviews.filter((review) => review.ok);
  const rejections = reviews.filter((review) => !review.ok);
  return {
    status: reviews.length > 0 && approvals.length > reviews.length / 2 ? "process_approved" as const : "process_rejected" as const,
    reviews,
    approvals,
    rejections
  };
};

test("Hermes-style agent completes a policy-gated bankroll loop", () => {
  const run = runPrimaryAgent(order, allowedRequest);
  const verdict = reviewBoard(run);

  assert.equal(run.evaluation.status, "allowed");
  assert.equal(run.action?.venueId, order.allowedVenueId);
  assert.ok(run.proof);
  assert.equal(verifyProof(run.proof).ok, true);
  assert.equal(assessFinanceability(run.proof).risk, "high");
  assert.equal(verdict.status, "process_approved");
  assert.equal(verdict.approvals.length, 3);
});

test("Hermes-style agent is stopped after an over-budget bankroll denial", () => {
  const run = runPrimaryAgent(order, deniedRequest);
  const verdict = reviewBoard(run);

  assert.equal(run.evaluation.status, "denied");
  assert.equal(run.policy, undefined);
  assert.equal(run.action, undefined);
  assert.equal(run.proof, undefined);
  assert.equal(verdict.status, "process_rejected");
  assert.match(verdict.rejections.map((review) => review.reason).join("\n"), /exceeds max per action|missing proof|missing action/);
});

test("review board rejects tampered proof replay", () => {
  const run = runPrimaryAgent(order, allowedRequest);
  assert.ok(run.proof);

  const tamperedRun: AgentRun = {
    ...run,
    proof: {
      ...run.proof,
      terms: { ...run.proof.terms, reason: "Different payable reason" }
    } as ProofOfPayable
  };
  const verdict = reviewBoard(tamperedRun);

  assert.equal(verifyProof(tamperedRun.proof!).ok, false);
  assert.equal(verdict.status, "process_rejected");
  assert.match(verdict.rejections.map((review) => review.reason).join("\n"), /terms\.reason/);
});

test("review board can reach majority process consensus", () => {
  const run = runPrimaryAgent(order, allowedRequest);
  const verdict = reviewBoard(run, [
    () => ({ reviewer: "market-performance", ok: false, reason: "market outcome not scored in process review" })
  ]);

  assert.equal(verdict.status, "process_approved");
  assert.equal(verdict.approvals.length, 3);
  assert.equal(verdict.rejections.length, 1);
});
