import type {
  DisputedPayable,
  EscrowedPayable,
  FundedPayable,
  FundingRef,
  IntentRef,
  Party,
  PayableTerms,
  PolicyApprovedPayable,
  PolicyRef,
  ProofBase,
  ProofOfPayable,
  ProposedPayable,
  RejectedPayable,
  RejectionRef,
  SettlementRef,
  SettledPayable,
  DisputeRef,
  EscrowRef
} from "./types.js";
import { verifyProof } from "./verify.js";

type BaseInput = {
  id: string;
  payer: Party;
  payee: Party;
  terms: PayableTerms;
  intent: IntentRef;
  createdAt?: string;
  updatedAt?: string;
};

type ComposeInput =
  | (BaseInput & { status: "proposed" })
  | (BaseInput & { status: "policy_approved"; policy: PolicyRef })
  | (BaseInput & { status: "funded"; policy: PolicyRef; funding: FundingRef })
  | (BaseInput & { status: "escrowed"; policy: PolicyRef; escrow: EscrowRef })
  | (BaseInput & { status: "settled"; policy: PolicyRef; settlement: SettlementRef })
  | (BaseInput & { status: "rejected"; rejection: RejectionRef })
  | (BaseInput & { status: "disputed"; policy: PolicyRef; dispute: DisputeRef });

const baseProof = (input: BaseInput): ProofBase => {
  const now = new Date().toISOString();
  return {
    version: "pop.v1",
    id: input.id,
    payer: input.payer,
    payee: input.payee,
    terms: input.terms,
    createdAt: input.createdAt ?? now,
    updatedAt: input.updatedAt ?? input.createdAt ?? now
  };
};

const assertValid = <T extends ProofOfPayable>(proof: T): T => {
  const result = verifyProof(proof);
  if (!result.ok) throw new Error(`Invalid proof: ${result.errors.join("; ")}`);
  return proof;
};

export const composeProposedPayable = (input: BaseInput): ProposedPayable =>
  assertValid({ ...baseProof(input), status: "proposed", intent: input.intent });

export const composePolicyApprovedPayable = (input: BaseInput & { policy: PolicyRef }): PolicyApprovedPayable =>
  assertValid({ ...baseProof(input), status: "policy_approved", intent: input.intent, policy: input.policy });

export const composeFundedPayable = (input: BaseInput & { policy: PolicyRef; funding: FundingRef }): FundedPayable =>
  assertValid({ ...baseProof(input), status: "funded", intent: input.intent, policy: input.policy, funding: input.funding });

export const composeEscrowedPayable = (input: BaseInput & { policy: PolicyRef; escrow: EscrowRef }): EscrowedPayable =>
  assertValid({ ...baseProof(input), status: "escrowed", intent: input.intent, policy: input.policy, escrow: input.escrow });

export const composeSettledPayable = (input: BaseInput & { policy: PolicyRef; settlement: SettlementRef }): SettledPayable =>
  assertValid({ ...baseProof(input), status: "settled", intent: input.intent, policy: input.policy, settlement: input.settlement });

export const composeRejectedPayable = (input: BaseInput & { rejection: RejectionRef }): RejectedPayable =>
  assertValid({ ...baseProof(input), status: "rejected", intent: input.intent, rejection: input.rejection });

export const composeDisputedPayable = (input: BaseInput & { policy: PolicyRef; dispute: DisputeRef }): DisputedPayable =>
  assertValid({ ...baseProof(input), status: "disputed", intent: input.intent, policy: input.policy, dispute: input.dispute });

export const composeProofOfPayable = (input: ComposeInput): ProofOfPayable => {
  switch (input.status) {
    case "proposed":
      return composeProposedPayable(input);
    case "policy_approved":
      return composePolicyApprovedPayable(input);
    case "funded":
      return composeFundedPayable(input);
    case "escrowed":
      return composeEscrowedPayable(input);
    case "settled":
      return composeSettledPayable(input);
    case "rejected":
      return composeRejectedPayable(input);
    case "disputed":
      return composeDisputedPayable(input);
  }
};
