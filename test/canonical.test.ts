import test from "node:test";
import assert from "node:assert/strict";

import { canonicalize } from "../src/canonical.js";

test("canonicalize sorts object keys recursively", () => {
  assert.equal(
    canonicalize({ z: 1, a: { d: 4, b: 2 }, c: [ { y: 2, x: 1 } ] }),
    '{"a":{"b":2,"d":4},"c":[{"x":1,"y":2}],"z":1}'
  );
});

test("canonicalize rejects undefined values", () => {
  assert.throws(() => canonicalize({ a: undefined }), /undefined/);
});
