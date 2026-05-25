const now = "2026-05-23T00:00:00.000Z";
const h = (n) => `0x${n.repeat(64)}`;
const envelope = {
    version: "envelope.v1",
    id: "env_arc_market_agent_001",
    name: "Market agent bankroll envelope",
    actor: {
        allowedActorIds: ["agent_market_researcher"],
        grantMode: "hard"
    },
    asset: {
        network: "arc-testnet",
        asset: "USDC"
    },
    amount: {
        maxPerAction: "25.00",
        maxPerPeriod: "100.00",
        period: "day"
    },
    target: {
        allowedRecipientIds: ["recipient_research_desk"],
        allowedVenueIds: ["venue_prediction_market_demo"]
    },
    schedule: {
        days: ["mon", "tue", "wed", "thu", "fri", "sat", "sun"],
        startHourUtc: 0,
        endHourUtc: 24
    },
    createdAt: "2026-05-23T00:00:00.000Z"
};
const policy = {
    envelopeId: "env_arc_market_agent_001",
    policyHash: "0x3053048252804b1892e052db8bd52c71d1f5be710bc8246d39535286318d8c1f",
    approvalHash: "0x44af15df5983653f5dc0c339bddd6422ee7869815e7f86c424f12a205abfcc92",
    approval: {
        version: "evaluation.v1",
        status: "allowed",
        requestId: "req_market_agent_001",
        requestHash: "0xe3d810c88443abc61bee60f482f0b7189bb63b216ba4353495e709b75ef75d25",
        evaluatedAt: "2026-05-23T12:00:01.000Z",
        reasons: ["All envelope rules passed."],
        request: {
            version: "request.v1",
            id: "req_market_agent_001",
            payerId: "org_microcosm_demo",
            actorId: "agent_market_researcher",
            asset: "USDC",
            network: "arc-testnet",
            amount: "20.00",
            reason: "Market agent bankroll request",
            target: { kind: "venue", venueId: "venue_prediction_market_demo" },
            requestedAt: "2026-05-23T12:00:00.000Z",
            spentInPeriod: "10.00"
        },
        envelope
    }
};
const base = {
    version: "pop.v1",
    payer: { kind: "organization", id: "org_microcosm_demo" },
    payee: { kind: "agent", id: "agent_market_researcher" },
    terms: {
        amount: "20.00",
        asset: "USDC",
        network: "arc-testnet",
        reason: "Market agent bankroll request"
    },
    createdAt: now,
    updatedAt: now,
    intent: {
        intentId: "req_market_agent_001",
        intentHash: policy.approval.requestHash
    }
};
export const proposedPayable = {
    ...base,
    id: "pop_proposed_001",
    status: "proposed"
};
export const policyApprovedPayable = {
    ...base,
    id: "pop_approved_001",
    status: "policy_approved",
    policy
};
export const escrowedAgentWork = {
    ...base,
    id: "pop_escrowed_001",
    status: "escrowed",
    policy,
    escrow: {
        escrowId: "escrow_agent_work_001",
        escrowTxHash: h("4")
    }
};
export const settledPayable = {
    ...base,
    id: "pop_settled_001",
    status: "settled",
    policy,
    settlement: {
        settlementId: "settlement_agent_work_001",
        settlementTxHash: h("5"),
        receiptHash: h("6"),
        auditHash: h("7")
    }
};
export const rejectedPayable = {
    ...base,
    id: "pop_rejected_001",
    status: "rejected",
    rejection: {
        reason: "Requested stake exceeds the policy envelope.",
        rejectionHash: h("8")
    }
};
