import type { DisputedPayable, EscrowedPayable, FundedPayable, FundingRef, IntentRef, Party, PayableTerms, PolicyApprovedPayable, PolicyRef, ProofOfPayable, ProposedPayable, RejectedPayable, RejectionRef, SettlementRef, SettledPayable, DisputeRef, EscrowRef } from "./types.js";
type BaseInput = {
    id: string;
    payer: Party;
    payee: Party;
    terms: PayableTerms;
    intent: IntentRef;
    createdAt?: string;
    updatedAt?: string;
};
type ComposeInput = (BaseInput & {
    status: "proposed";
}) | (BaseInput & {
    status: "policy_approved";
    policy: PolicyRef;
}) | (BaseInput & {
    status: "funded";
    policy: PolicyRef;
    funding: FundingRef;
}) | (BaseInput & {
    status: "escrowed";
    policy: PolicyRef;
    escrow: EscrowRef;
}) | (BaseInput & {
    status: "settled";
    policy: PolicyRef;
    settlement: SettlementRef;
}) | (BaseInput & {
    status: "rejected";
    rejection: RejectionRef;
}) | (BaseInput & {
    status: "disputed";
    policy: PolicyRef;
    dispute: DisputeRef;
});
export declare const composeProposedPayable: (input: BaseInput) => ProposedPayable;
export declare const composePolicyApprovedPayable: (input: BaseInput & {
    policy: PolicyRef;
}) => PolicyApprovedPayable;
export declare const composeFundedPayable: (input: BaseInput & {
    policy: PolicyRef;
    funding: FundingRef;
}) => FundedPayable;
export declare const composeEscrowedPayable: (input: BaseInput & {
    policy: PolicyRef;
    escrow: EscrowRef;
}) => EscrowedPayable;
export declare const composeSettledPayable: (input: BaseInput & {
    policy: PolicyRef;
    settlement: SettlementRef;
}) => SettledPayable;
export declare const composeRejectedPayable: (input: BaseInput & {
    rejection: RejectionRef;
}) => RejectedPayable;
export declare const composeDisputedPayable: (input: BaseInput & {
    policy: PolicyRef;
    dispute: DisputeRef;
}) => DisputedPayable;
export declare const composeProofOfPayable: (input: ComposeInput) => ProofOfPayable;
export {};
