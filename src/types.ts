export type Hex = `0x${string}`;

export type ArcNetwork = "arc-testnet" | "arc-mainnet";
export type PayableAsset = "USDC" | "EURC";
export type PartyKind = "user" | "organization" | "agent" | "wallet" | "recipient";

export type Party = {
  kind: PartyKind;
  id: string;
};

export type PayableTerms = {
  amount: string;
  asset: PayableAsset;
  network: ArcNetwork;
  reason: string;
};

export type IntentRef = {
  intentId: string;
  intentHash: Hex;
};

export type PolicyRef = {
  envelopeId: string;
  policyHash: Hex;
  approvalHash: Hex;
  approval: {
    version: "evaluation.v1";
    status: "allowed";
    requestId: string;
    requestHash: Hex;
    evaluatedAt: string;
    reasons: string[];
    request: {
      version: "request.v1";
      id: string;
      payerId: string;
      actorId: string;
      asset: PayableAsset;
      network: ArcNetwork;
      amount: string;
      reason: string;
      target: { kind: "recipient"; recipientId: string } | { kind: "venue"; venueId: string };
      requestedAt: string;
      spentInPeriod: string;
    };
    envelope: {
      version: "envelope.v1";
      id: string;
      name: string;
      actor: {
        allowedActorIds: string[];
        grantMode: "soft" | "hard" | "hybrid";
      };
      asset: {
        network: ArcNetwork;
        asset: PayableAsset;
      };
      amount: {
        maxPerAction: string;
        maxPerPeriod: string;
        period: "day" | "week" | "month";
      };
      target: {
        allowedRecipientIds: string[];
        allowedVenueIds: string[];
      };
      schedule: {
        days: Array<"mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun">;
        startHourUtc: number;
        endHourUtc: number;
      };
      createdAt: string;
    };
  };
};

export type FundingRef = {
  fundingId: string;
  fundingTxHash: Hex;
};

export type EscrowRef = {
  escrowId: string;
  escrowTxHash: Hex;
};

export type SettlementRef = {
  settlementId: string;
  settlementTxHash: Hex;
  receiptHash: Hex;
  auditHash: Hex;
};

export type RejectionRef = {
  reason: string;
  rejectionHash: Hex;
};

export type DisputeRef = {
  reason: string;
  disputeHash: Hex;
};

export type ProofBase = {
  version: "pop.v1";
  id: string;
  payer: Party;
  payee: Party;
  terms: PayableTerms;
  createdAt: string;
  updatedAt: string;
};

export type ProposedPayable = ProofBase & {
  status: "proposed";
  intent: IntentRef;
};

export type PolicyApprovedPayable = ProofBase & {
  status: "policy_approved";
  intent: IntentRef;
  policy: PolicyRef;
};

export type FundedPayable = ProofBase & {
  status: "funded";
  intent: IntentRef;
  policy: PolicyRef;
  funding: FundingRef;
};

export type EscrowedPayable = ProofBase & {
  status: "escrowed";
  intent: IntentRef;
  policy: PolicyRef;
  escrow: EscrowRef;
};

export type SettledPayable = ProofBase & {
  status: "settled";
  intent: IntentRef;
  policy: PolicyRef;
  settlement: SettlementRef;
};

export type RejectedPayable = ProofBase & {
  status: "rejected";
  intent: IntentRef;
  rejection: RejectionRef;
};

export type DisputedPayable = ProofBase & {
  status: "disputed";
  intent: IntentRef;
  policy: PolicyRef;
  dispute: DisputeRef;
};

export type ProofOfPayable =
  | ProposedPayable
  | PolicyApprovedPayable
  | FundedPayable
  | EscrowedPayable
  | SettledPayable
  | RejectedPayable
  | DisputedPayable;

export type PayableStatus = ProofOfPayable["status"];

export type VerificationResult = {
  ok: boolean;
  proofHash: Hex;
  errors: string[];
};

export type FinanceabilityResult = {
  financeable: boolean;
  risk: "low" | "medium" | "high" | "ineligible";
  reasons: string[];
};
