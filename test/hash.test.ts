import test from "node:test";
import assert from "node:assert/strict";

import { hashBytes, hashProof, proposedPayable } from "../src/index.js";

test("hashBytes is deterministic for reordered object keys", () => {
  assert.equal(hashBytes({ a: 1, b: 2 }), hashBytes({ b: 2, a: 1 }));
});

test("hashProof changes when proof content is tampered", () => {
  const original = hashProof(proposedPayable);
  const tampered = hashProof({
    ...proposedPayable,
    terms: { ...proposedPayable.terms, amount: "26.00" }
  });
  assert.notEqual(original, tampered);
});
