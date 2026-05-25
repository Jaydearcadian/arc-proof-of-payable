import { hashBytes, hashProof } from "./hash.js";
import type { Hex, ProofOfPayable, VerificationResult } from "./types.js";

const HEX_32 = /^0x[a-fA-F0-9]{64}$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}T/;
const POSITIVE_AMOUNT = /^(?:0|[1-9]\d*)(?:\.\d+)?$/;
const DECIMAL_6 = /^(?:0|[1-9]\d*)(?:\.\d{1,6})?$/;
const BASE_KEYS = ["createdAt", "id", "intent", "payee", "payer", "status", "terms", "updatedAt", "version"];
const INVALID_PROOF_HASH: Hex = "0x0000000000000000000000000000000000000000000000000000000000000000";
const WEEKDAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const requireText = (errors: string[], value: unknown, path: string) => {
  if (typeof value !== "string" || value.trim() === "") errors.push(`${path} must be a non-empty string`);
};

const rejectUnexpectedKeys = (errors: string[], value: Record<string, unknown>, path: string, allowed: string[]) => {
  const allowedSet = new Set(allowed);
  for (const key of Object.keys(value)) {
    if (!allowedSet.has(key)) errors.push(`${path}.${key} is not allowed`);
    if (value[key] === undefined) errors.push(`${path}.${key} must not be undefined`);
  }
};

const requireHex = (errors: string[], value: unknown, path: string) => {
  if (typeof value !== "string" || !HEX_32.test(value)) errors.push(`${path} must be a 32-byte hex string`);
};

const parsePolicyAmount = (value: unknown, allowZero = false): bigint | undefined => {
  if (typeof value !== "string" || !DECIMAL_6.test(value)) return undefined;
  const [whole, fraction = ""] = value.split(".");
  const units = BigInt(whole) * 1_000_000n + BigInt(fraction.padEnd(6, "0"));
  return units > 0n || allowZero ? units : undefined;
};

const isWithinSchedule = (schedule: Record<string, unknown>, requestedAt: unknown): boolean => {
  if (!Array.isArray(schedule.days) || typeof requestedAt !== "string") return false;
  const date = new Date(requestedAt);
  if (Number.isNaN(date.getTime())) return false;
  const day = WEEKDAYS[date.getUTCDay()];
  const hour = date.getUTCHours();
  if (!schedule.days.includes(day)) return false;
  if (typeof schedule.startHourUtc !== "number" || typeof schedule.endHourUtc !== "number") return false;
  if (schedule.startHourUtc === schedule.endHourUtc) return false;
  if (schedule.startHourUtc < schedule.endHourUtc) return hour >= schedule.startHourUtc && hour < schedule.endHourUtc;
  return hour >= schedule.startHourUtc || hour < schedule.endHourUtc;
};

const requireDate = (errors: string[], value: unknown, path: string) => {
  if (typeof value !== "string" || !ISO_DATE.test(value) || Number.isNaN(Date.parse(value))) {
    errors.push(`${path} must be an ISO timestamp`);
  }
};

const requireParty = (errors: string[], value: unknown, path: string) => {
  if (!isRecord(value)) {
    errors.push(`${path} must be an object`);
    return;
  }
  rejectUnexpectedKeys(errors, value, path, ["id", "kind"]);
  if (!["user", "organization", "agent", "wallet", "recipient"].includes(String(value.kind))) {
    errors.push(`${path}.kind is invalid`);
  }
  requireText(errors, value.id, `${path}.id`);
};

const requireTerms = (errors: string[], value: unknown) => {
  if (!isRecord(value)) {
    errors.push("terms must be an object");
    return;
  }
  rejectUnexpectedKeys(errors, value, "terms", ["amount", "asset", "network", "reason"]);
  if (typeof value.amount !== "string" || !POSITIVE_AMOUNT.test(value.amount) || Number(value.amount) <= 0) errors.push("terms.amount must be a positive decimal string");
  if (!["USDC", "EURC"].includes(String(value.asset))) errors.push("terms.asset is invalid");
  if (!["arc-testnet", "arc-mainnet"].includes(String(value.network))) errors.push("terms.network is invalid");
  requireText(errors, value.reason, "terms.reason");
};

const requireIntent = (errors: string[], value: unknown) => {
  if (!isRecord(value)) {
    errors.push("intent must be an object");
    return;
  }
  rejectUnexpectedKeys(errors, value, "intent", ["intentHash", "intentId"]);
  requireText(errors, value.intentId, "intent.intentId");
  requireHex(errors, value.intentHash, "intent.intentHash");
};

const allowedPolicyErrors = (envelope: Record<string, unknown>, request: Record<string, unknown>): string[] => {
  const errors: string[] = [];
  const actor = isRecord(envelope.actor) ? envelope.actor : undefined;
  const asset = isRecord(envelope.asset) ? envelope.asset : undefined;
  const amount = isRecord(envelope.amount) ? envelope.amount : undefined;
  const target = isRecord(envelope.target) ? envelope.target : undefined;
  const schedule = isRecord(envelope.schedule) ? envelope.schedule : undefined;
  const requestTarget = isRecord(request.target) ? request.target : undefined;

  if (!actor || !Array.isArray(actor.allowedActorIds) || !actor.allowedActorIds.includes(request.actorId)) {
    errors.push("request actor is not allowed by policy envelope");
  }
  if (!asset || request.asset !== asset.asset || request.network !== asset.network) {
    errors.push("request asset or network is not allowed by policy envelope");
  }
  if (!amount) {
    errors.push("policy envelope amount rule is invalid");
  } else {
    const requestAmount = parsePolicyAmount(request.amount);
    const spent = parsePolicyAmount(request.spentInPeriod, true);
    const maxPerAction = parsePolicyAmount(amount.maxPerAction);
    const maxPerPeriod = parsePolicyAmount(amount.maxPerPeriod);
    if (requestAmount === undefined || spent === undefined || maxPerAction === undefined || maxPerPeriod === undefined) {
      errors.push("request or policy amount is invalid");
    } else {
      if (requestAmount > maxPerAction) errors.push("request amount exceeds policy max per action");
      if (requestAmount + spent > maxPerPeriod) errors.push("request amount plus spend exceeds policy max per period");
    }
  }
  if (!target || !requestTarget) {
    errors.push("policy target rule is invalid");
  } else if (requestTarget.kind === "recipient") {
    if (!Array.isArray(target.allowedRecipientIds) || !target.allowedRecipientIds.includes(requestTarget.recipientId)) {
      errors.push("request recipient is not allowed by policy envelope");
    }
  } else if (requestTarget.kind === "venue") {
    if (!Array.isArray(target.allowedVenueIds) || !target.allowedVenueIds.includes(requestTarget.venueId)) {
      errors.push("request venue is not allowed by policy envelope");
    }
  } else {
    errors.push("request target kind is invalid");
  }
  if (!schedule || !isWithinSchedule(schedule, request.requestedAt)) {
    errors.push("request timestamp is outside the policy schedule");
  }
  return errors;
};

const requirePolicy = (errors: string[], value: unknown, proof: Record<string, unknown>) => {
  if (!isRecord(value)) {
    errors.push("policy must be an object");
    return;
  }
  const startErrorCount = errors.length;
  rejectUnexpectedKeys(errors, value, "policy", ["approval", "approvalHash", "envelopeId", "policyHash"]);
  requireText(errors, value.envelopeId, "policy.envelopeId");
  requireHex(errors, value.policyHash, "policy.policyHash");
  requireHex(errors, value.approvalHash, "policy.approvalHash");

  if (!isRecord(value.approval)) {
    errors.push("policy.approval must be an object");
    return;
  }
  rejectUnexpectedKeys(errors, value.approval, "policy.approval", ["envelope", "evaluatedAt", "reasons", "request", "requestHash", "requestId", "status", "version"]);
  if (value.approval.version !== "evaluation.v1") errors.push("policy.approval.version must be evaluation.v1");
  if (value.approval.status !== "allowed") errors.push("policy.approval.status must be allowed");
  requireText(errors, value.approval.requestId, "policy.approval.requestId");
  requireHex(errors, value.approval.requestHash, "policy.approval.requestHash");
  requireDate(errors, value.approval.evaluatedAt, "policy.approval.evaluatedAt");
  if (!Array.isArray(value.approval.reasons) || value.approval.reasons.length !== 1 || value.approval.reasons[0] !== "All envelope rules passed.") {
    errors.push("policy.approval.reasons must match an allowed policy evaluation");
  }
  if (!isRecord(value.approval.request)) {
    errors.push("policy.approval.request must be an object");
  } else {
    const request = value.approval.request;
    rejectUnexpectedKeys(errors, request, "policy.approval.request", ["actorId", "amount", "asset", "id", "network", "payerId", "reason", "requestedAt", "spentInPeriod", "target", "version"]);
    if (request.version !== "request.v1") errors.push("policy.approval.request.version must be request.v1");
    requireText(errors, request.id, "policy.approval.request.id");
    requireText(errors, request.payerId, "policy.approval.request.payerId");
    requireText(errors, request.actorId, "policy.approval.request.actorId");
    requireText(errors, request.reason, "policy.approval.request.reason");
    if (typeof request.amount !== "string" || !POSITIVE_AMOUNT.test(request.amount) || Number(request.amount) <= 0) {
      errors.push("policy.approval.request.amount must be a positive decimal string");
    }
    if (typeof request.spentInPeriod !== "string" || !POSITIVE_AMOUNT.test(request.spentInPeriod)) {
      errors.push("policy.approval.request.spentInPeriod must be a decimal string");
    }
    if (!["USDC", "EURC"].includes(String(request.asset))) errors.push("policy.approval.request.asset is invalid");
    if (!["arc-testnet", "arc-mainnet"].includes(String(request.network))) errors.push("policy.approval.request.network is invalid");
    requireDate(errors, request.requestedAt, "policy.approval.request.requestedAt");
    if (!isRecord(request.target)) {
      errors.push("policy.approval.request.target must be an object");
    } else if (request.target.kind === "recipient") {
      rejectUnexpectedKeys(errors, request.target, "policy.approval.request.target", ["kind", "recipientId"]);
      requireText(errors, request.target.recipientId, "policy.approval.request.target.recipientId");
    } else if (request.target.kind === "venue") {
      rejectUnexpectedKeys(errors, request.target, "policy.approval.request.target", ["kind", "venueId"]);
      requireText(errors, request.target.venueId, "policy.approval.request.target.venueId");
    } else {
      errors.push("policy.approval.request.target.kind is invalid");
    }
    if (request.id !== value.approval.requestId) errors.push("policy.approval.request.id must match policy.approval.requestId");
    if (errors.length === startErrorCount && hashBytes(request).toLowerCase() !== String(value.approval.requestHash).toLowerCase()) {
      errors.push("policy.approval.requestHash must match policy.approval.request");
    }
    if (isRecord(proof.intent)) {
      if (proof.intent.intentId !== request.id) errors.push("intent.intentId must match policy.approval.request.id");
      if (String(proof.intent.intentHash).toLowerCase() !== String(value.approval.requestHash).toLowerCase()) {
        errors.push("intent.intentHash must match policy.approval.requestHash");
      }
    }
    if (isRecord(proof.payer)) {
      if (proof.payer.id !== request.payerId) errors.push("payer.id must match policy.approval.request.payerId");
    }
    if (isRecord(proof.payee)) {
      if (proof.payee.kind !== "agent") errors.push("payee.kind must be agent for policy-approved proofs");
      if (proof.payee.id !== request.actorId) errors.push("payee.id must match policy.approval.request.actorId");
    }
    if (isRecord(proof.terms)) {
      if (proof.terms.amount !== request.amount) errors.push("terms.amount must match policy.approval.request.amount");
      if (proof.terms.asset !== request.asset) errors.push("terms.asset must match policy.approval.request.asset");
      if (proof.terms.network !== request.network) errors.push("terms.network must match policy.approval.request.network");
      if (proof.terms.reason !== request.reason) errors.push("terms.reason must match policy.approval.request.reason");
    }
  }

  if (!isRecord(value.approval.envelope)) {
    errors.push("policy.approval.envelope must be an object");
  } else {
    const envelope = value.approval.envelope;
    rejectUnexpectedKeys(errors, envelope, "policy.approval.envelope", ["actor", "amount", "asset", "createdAt", "id", "name", "schedule", "target", "version"]);
    if (envelope.version !== "envelope.v1") errors.push("policy.approval.envelope.version must be envelope.v1");
    requireText(errors, envelope.id, "policy.approval.envelope.id");
    requireText(errors, envelope.name, "policy.approval.envelope.name");
    requireDate(errors, envelope.createdAt, "policy.approval.envelope.createdAt");
    if (envelope.id !== value.envelopeId) errors.push("policy.approval.envelope.id must match policy.envelopeId");
    if (isRecord(envelope.actor)) {
      rejectUnexpectedKeys(errors, envelope.actor, "policy.approval.envelope.actor", ["allowedActorIds", "grantMode"]);
      if (!Array.isArray(envelope.actor.allowedActorIds)) errors.push("policy.approval.envelope.actor.allowedActorIds must be an array");
      if (!["soft", "hard", "hybrid"].includes(String(envelope.actor.grantMode))) errors.push("policy.approval.envelope.actor.grantMode is invalid");
    } else {
      errors.push("policy.approval.envelope.actor must be an object");
    }
    if (isRecord(envelope.asset)) {
      rejectUnexpectedKeys(errors, envelope.asset, "policy.approval.envelope.asset", ["asset", "network"]);
      if (!["USDC", "EURC"].includes(String(envelope.asset.asset))) errors.push("policy.approval.envelope.asset.asset is invalid");
      if (!["arc-testnet", "arc-mainnet"].includes(String(envelope.asset.network))) errors.push("policy.approval.envelope.asset.network is invalid");
    } else {
      errors.push("policy.approval.envelope.asset must be an object");
    }
    if (isRecord(envelope.amount)) {
      rejectUnexpectedKeys(errors, envelope.amount, "policy.approval.envelope.amount", ["maxPerAction", "maxPerPeriod", "period"]);
      if (parsePolicyAmount(envelope.amount.maxPerAction) === undefined) errors.push("policy.approval.envelope.amount.maxPerAction is invalid");
      if (parsePolicyAmount(envelope.amount.maxPerPeriod) === undefined) errors.push("policy.approval.envelope.amount.maxPerPeriod is invalid");
      if (!["day", "week", "month"].includes(String(envelope.amount.period))) errors.push("policy.approval.envelope.amount.period is invalid");
    } else {
      errors.push("policy.approval.envelope.amount must be an object");
    }
    if (isRecord(envelope.target)) {
      rejectUnexpectedKeys(errors, envelope.target, "policy.approval.envelope.target", ["allowedRecipientIds", "allowedVenueIds"]);
      if (!Array.isArray(envelope.target.allowedRecipientIds)) errors.push("policy.approval.envelope.target.allowedRecipientIds must be an array");
      if (!Array.isArray(envelope.target.allowedVenueIds)) errors.push("policy.approval.envelope.target.allowedVenueIds must be an array");
    } else {
      errors.push("policy.approval.envelope.target must be an object");
    }
    if (isRecord(envelope.schedule)) {
      rejectUnexpectedKeys(errors, envelope.schedule, "policy.approval.envelope.schedule", ["days", "endHourUtc", "startHourUtc"]);
      if (!Array.isArray(envelope.schedule.days)) errors.push("policy.approval.envelope.schedule.days must be an array");
      if (typeof envelope.schedule.startHourUtc !== "number") errors.push("policy.approval.envelope.schedule.startHourUtc must be a number");
      if (typeof envelope.schedule.endHourUtc !== "number") errors.push("policy.approval.envelope.schedule.endHourUtc must be a number");
    } else {
      errors.push("policy.approval.envelope.schedule must be an object");
    }
    if (errors.length === startErrorCount && hashBytes(envelope).toLowerCase() !== String(value.policyHash).toLowerCase()) {
      errors.push("policy.policyHash must match policy.approval.envelope");
    }
    if (errors.length === startErrorCount && isRecord(value.approval.request)) {
      const policyErrors = allowedPolicyErrors(envelope, value.approval.request);
      if (policyErrors.length > 0) errors.push(`policy.approval.request is not allowed by envelope: ${policyErrors.join("; ")}`);
    }
  }

  if (errors.length === startErrorCount) {
    const expectedApprovalHash = hashBytes({
      type: "policy.approval.v1",
      version: "evaluation.v1",
      envelopeId: value.envelopeId,
      requestId: value.approval.requestId,
      policyHash: value.policyHash,
      requestHash: value.approval.requestHash,
      evaluatedAt: value.approval.evaluatedAt,
      status: "allowed",
      reasons: value.approval.reasons
    });
    if (String(value.approvalHash).toLowerCase() !== expectedApprovalHash.toLowerCase()) {
      errors.push("policy.approvalHash must match policy.approval evidence");
    }
  }
};

export const validateProof = (proof: unknown): string[] => {
  const errors: string[] = [];
  if (!isRecord(proof)) return ["proof must be an object"];

  if (proof.version !== "pop.v1") errors.push("version must be pop.v1");
  requireText(errors, proof.id, "id");
  requireParty(errors, proof.payer, "payer");
  requireParty(errors, proof.payee, "payee");
  requireTerms(errors, proof.terms);
  requireDate(errors, proof.createdAt, "createdAt");
  requireDate(errors, proof.updatedAt, "updatedAt");
  requireIntent(errors, proof.intent);

  switch (proof.status) {
    case "proposed":
      rejectUnexpectedKeys(errors, proof, "proof", BASE_KEYS);
      break;
    case "policy_approved":
      rejectUnexpectedKeys(errors, proof, "proof", [...BASE_KEYS, "policy"]);
      requirePolicy(errors, proof.policy, proof);
      break;
    case "funded":
      rejectUnexpectedKeys(errors, proof, "proof", [...BASE_KEYS, "policy", "funding"]);
      requirePolicy(errors, proof.policy, proof);
      if (!isRecord(proof.funding)) errors.push("funding must be an object");
      else {
        rejectUnexpectedKeys(errors, proof.funding, "funding", ["fundingId", "fundingTxHash"]);
        requireText(errors, proof.funding.fundingId, "funding.fundingId");
        requireHex(errors, proof.funding.fundingTxHash, "funding.fundingTxHash");
      }
      break;
    case "escrowed":
      rejectUnexpectedKeys(errors, proof, "proof", [...BASE_KEYS, "policy", "escrow"]);
      requirePolicy(errors, proof.policy, proof);
      if (!isRecord(proof.escrow)) errors.push("escrow must be an object");
      else {
        rejectUnexpectedKeys(errors, proof.escrow, "escrow", ["escrowId", "escrowTxHash"]);
        requireText(errors, proof.escrow.escrowId, "escrow.escrowId");
        requireHex(errors, proof.escrow.escrowTxHash, "escrow.escrowTxHash");
      }
      break;
    case "settled":
      rejectUnexpectedKeys(errors, proof, "proof", [...BASE_KEYS, "policy", "settlement"]);
      requirePolicy(errors, proof.policy, proof);
      if (!isRecord(proof.settlement)) errors.push("settlement must be an object");
      else {
        rejectUnexpectedKeys(errors, proof.settlement, "settlement", ["auditHash", "receiptHash", "settlementId", "settlementTxHash"]);
        requireText(errors, proof.settlement.settlementId, "settlement.settlementId");
        requireHex(errors, proof.settlement.settlementTxHash, "settlement.settlementTxHash");
        requireHex(errors, proof.settlement.receiptHash, "settlement.receiptHash");
        requireHex(errors, proof.settlement.auditHash, "settlement.auditHash");
      }
      break;
    case "rejected":
      rejectUnexpectedKeys(errors, proof, "proof", [...BASE_KEYS, "rejection"]);
      if (!isRecord(proof.rejection)) errors.push("rejection must be an object");
      else {
        rejectUnexpectedKeys(errors, proof.rejection, "rejection", ["reason", "rejectionHash"]);
        requireText(errors, proof.rejection.reason, "rejection.reason");
        requireHex(errors, proof.rejection.rejectionHash, "rejection.rejectionHash");
      }
      break;
    case "disputed":
      rejectUnexpectedKeys(errors, proof, "proof", [...BASE_KEYS, "policy", "dispute"]);
      requirePolicy(errors, proof.policy, proof);
      if (!isRecord(proof.dispute)) errors.push("dispute must be an object");
      else {
        rejectUnexpectedKeys(errors, proof.dispute, "dispute", ["disputeHash", "reason"]);
        requireText(errors, proof.dispute.reason, "dispute.reason");
        requireHex(errors, proof.dispute.disputeHash, "dispute.disputeHash");
      }
      break;
    default:
      errors.push("status is invalid");
  }

  return errors;
};

export const verifyProof = (proof: ProofOfPayable, expectedHash?: Hex): VerificationResult => {
  const errors = validateProof(proof);
  let proofHash = INVALID_PROOF_HASH;
  try {
    proofHash = hashProof(proof);
  } catch (error) {
    errors.push(error instanceof Error ? error.message : "proof could not be hashed");
  }
  if (expectedHash && proofHash.toLowerCase() !== expectedHash.toLowerCase()) {
    errors.push("proof hash does not match expected hash");
  }
  return { ok: errors.length === 0, proofHash, errors };
};
