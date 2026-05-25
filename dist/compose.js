import { verifyProof } from "./verify.js";
const baseProof = (input) => {
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
const assertValid = (proof) => {
    const result = verifyProof(proof);
    if (!result.ok)
        throw new Error(`Invalid proof: ${result.errors.join("; ")}`);
    return proof;
};
export const composeProposedPayable = (input) => assertValid({ ...baseProof(input), status: "proposed", intent: input.intent });
export const composePolicyApprovedPayable = (input) => assertValid({ ...baseProof(input), status: "policy_approved", intent: input.intent, policy: input.policy });
export const composeFundedPayable = (input) => assertValid({ ...baseProof(input), status: "funded", intent: input.intent, policy: input.policy, funding: input.funding });
export const composeEscrowedPayable = (input) => assertValid({ ...baseProof(input), status: "escrowed", intent: input.intent, policy: input.policy, escrow: input.escrow });
export const composeSettledPayable = (input) => assertValid({ ...baseProof(input), status: "settled", intent: input.intent, policy: input.policy, settlement: input.settlement });
export const composeRejectedPayable = (input) => assertValid({ ...baseProof(input), status: "rejected", intent: input.intent, rejection: input.rejection });
export const composeDisputedPayable = (input) => assertValid({ ...baseProof(input), status: "disputed", intent: input.intent, policy: input.policy, dispute: input.dispute });
export const composeProofOfPayable = (input) => {
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
