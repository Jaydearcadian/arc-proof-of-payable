import { createHash } from "node:crypto";
import { canonicalize } from "./canonical.js";
export const hashBytes = (value) => `0x${createHash("sha256").update(canonicalize(value)).digest("hex")}`;
export const hashProof = (proof) => hashBytes(proof);
