import type { Hex, ProofOfPayable, VerificationResult } from "./types.js";
export declare const validateProof: (proof: unknown) => string[];
export declare const verifyProof: (proof: ProofOfPayable, expectedHash?: Hex) => VerificationResult;
