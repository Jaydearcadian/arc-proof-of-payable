import { createHash } from "node:crypto";

import { canonicalize } from "./canonical.js";
import type { Hex, ProofOfPayable } from "./types.js";

export const hashBytes = (value: unknown): Hex =>
  `0x${createHash("sha256").update(canonicalize(value)).digest("hex")}`;

export const hashProof = (proof: ProofOfPayable): Hex => hashBytes(proof);
