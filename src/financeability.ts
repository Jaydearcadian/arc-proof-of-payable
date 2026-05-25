import { validateProof } from "./verify.js";
import type { FinanceabilityResult, ProofOfPayable } from "./types.js";

export const assessFinanceability = (proof: ProofOfPayable): FinanceabilityResult => {
  const validationErrors = validateProof(proof);
  if (validationErrors.length > 0) {
    return {
      financeable: false,
      risk: "ineligible",
      reasons: validationErrors
    };
  }

  switch (proof.status) {
    case "escrowed":
      return {
        financeable: true,
        risk: "low",
        reasons: ["Structurally financeable: payable is escrowed with policy evidence and an escrow transaction hash. Verify the source system and Arc transaction before underwriting."]
      };
    case "funded":
      return {
        financeable: true,
        risk: "medium",
        reasons: ["Structurally financeable: payable is funded, but final settlement receipt is not present yet. Verify the source system and Arc transaction before underwriting."]
      };
    case "policy_approved":
      return {
        financeable: true,
        risk: "high",
        reasons: ["Structurally financeable: payable passed policy but has not been funded or escrowed. Verify the source system before underwriting."]
      };
    case "settled":
      return {
        financeable: false,
        risk: "ineligible",
        reasons: ["Payable is already settled."]
      };
    case "proposed":
      return {
        financeable: false,
        risk: "ineligible",
        reasons: ["Payable has not passed policy evaluation."]
      };
    case "rejected":
      return {
        financeable: false,
        risk: "ineligible",
        reasons: ["Payable was rejected."]
      };
    case "disputed":
      return {
        financeable: false,
        risk: "ineligible",
        reasons: ["Payable is disputed."]
      };
  }
};
