import type { Hex, ProofOfPayable } from "./types.js";
export declare const hashBytes: (value: unknown) => Hex;
export declare const hashProof: (proof: ProofOfPayable) => Hex;
