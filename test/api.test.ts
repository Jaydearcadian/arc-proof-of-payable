import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";

import { handleRequest } from "../src/api.js";
import { escrowedAgentWork } from "../src/examples.js";

const withServer = async (run: (baseUrl: string) => Promise<void>) => {
  const server = createServer(handleRequest);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.equal(typeof address, "object");
  assert.ok(address);
  try {
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
};

test("api verifies and assesses proof of payable", async () => {
  await withServer(async (baseUrl) => {
    const verifyResponse = await fetch(`${baseUrl}/proofs/verify`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ proof: escrowedAgentWork })
    });
    assert.equal(verifyResponse.status, 200);
    assert.equal((await verifyResponse.json() as { ok: boolean }).ok, true);

    const financeResponse = await fetch(`${baseUrl}/proofs/financeability`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ proof: escrowedAgentWork })
    });
    assert.equal(financeResponse.status, 200);
    const financeability = await financeResponse.json() as { financeable: boolean; trust: string; warning: string };
    assert.equal(financeability.financeable, true);
    assert.equal(financeability.trust, "self_asserted");
    assert.match(financeability.warning, /structural/i);
  });
});

test("api returns deterministic 413 for oversized bodies", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/proofs/verify`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ padding: "x".repeat(300_000) })
    });
    assert.equal(response.status, 413);
    assert.match((await response.json() as { error: string }).error, /too large/);
  });
});

test("api composes an escrowed proof", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/proofs/compose`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        status: "escrowed",
        id: escrowedAgentWork.id,
        payer: escrowedAgentWork.payer,
        payee: escrowedAgentWork.payee,
        terms: escrowedAgentWork.terms,
        intent: escrowedAgentWork.intent,
        policy: escrowedAgentWork.policy,
        escrow: escrowedAgentWork.escrow,
        createdAt: escrowedAgentWork.createdAt,
        updatedAt: escrowedAgentWork.updatedAt
      })
    });
    assert.equal(response.status, 200);
    const payload = await response.json() as { proof: { status: string }; verification: { ok: boolean } };
    assert.equal(payload.proof.status, "escrowed");
    assert.equal(payload.verification.ok, true);
  });
});

test("api composes funded and disputed proofs used by the showcase", async () => {
  await withServer(async (baseUrl) => {
    for (const input of [
      {
        status: "funded",
        id: "pop_funded_001",
        payer: escrowedAgentWork.payer,
        payee: escrowedAgentWork.payee,
        terms: escrowedAgentWork.terms,
        intent: escrowedAgentWork.intent,
        policy: escrowedAgentWork.policy,
        funding: { fundingId: "funding_agent_work_001", fundingTxHash: "0x9999999999999999999999999999999999999999999999999999999999999999" },
        createdAt: escrowedAgentWork.createdAt,
        updatedAt: escrowedAgentWork.updatedAt
      },
      {
        status: "disputed",
        id: "pop_disputed_001",
        payer: escrowedAgentWork.payer,
        payee: escrowedAgentWork.payee,
        terms: escrowedAgentWork.terms,
        intent: escrowedAgentWork.intent,
        policy: escrowedAgentWork.policy,
        dispute: { reason: "Evaluator disputes the submitted deliverable.", disputeHash: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" },
        createdAt: escrowedAgentWork.createdAt,
        updatedAt: escrowedAgentWork.updatedAt
      }
    ]) {
      const response = await fetch(`${baseUrl}/proofs/compose`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input)
      });
      assert.equal(response.status, 200);
      const payload = await response.json() as { proof: { status: string }; verification: { ok: boolean } };
      assert.equal(payload.proof.status, input.status);
      assert.equal(payload.verification.ok, true);
    }
  });
});
