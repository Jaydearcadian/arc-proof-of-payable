# Arc Proof of Payable

Lifecycle-specific, verifiable payable proofs for Arc builders.

Arc Proof of Payable is a small TypeScript primitive for turning payment obligations, policy approvals, escrow states, and settlement receipts into portable proof objects. It is designed for Arc applications that need to prove that value is owed, funded, escrowed, settled, rejected, or disputed without forcing every builder to invent their own proof shape.

## What it enables

- **Agent work claims**: prove an autonomous agent is owed USDC for a funded work order.
- **Receivables financing**: let lenders inspect approved, funded, or escrowed payables before advancing capital.
- **Claimable payment liquidity**: prove that a recipient has a pending payable before wallet claim completes.
- **Vendor and creator advances**: turn approved future payouts into structured evidence.
- **Market-agent bankroll controls**: prove a market agent request passed a policy envelope before USDC was released.
- **Auditable Arc settlement trails**: connect intent, policy, funding/escrow, settlement, receipt, and audit hashes.

## Why Arc

Arc is USDC-native and EVM-compatible, making it a natural settlement rail for programmable payables. This primitive assumes Arc-friendly payment objects:

- `network`: `arc-testnet` or `arc-mainnet`
- `asset`: `USDC` or `EURC`
- transaction hashes are represented as 32-byte hex values
- proof objects are deterministic and portable across services

This package does not submit transactions, hold keys, or call RPC endpoints. It only defines, hashes, verifies, and assesses proof objects.

## Primitive model

Proof of Payable is intentionally not a single loose object with optional fields. Instead, it uses lifecycle-specific proof types. Each status requires exactly the evidence needed for that stage.

```text
proposed
  -> policy_approved
  -> funded / escrowed
  -> settled

proposed / policy_approved
  -> rejected

escrowed
  -> disputed
```

## Statuses

| Status | Meaning | Required evidence |
| --- | --- | --- |
| `proposed` | A payable has been requested but not approved. | intent hash |
| `policy_approved` | A payable passed a policy envelope. | intent hash, policy hash, approval hash, allowed evaluation evidence |
| `funded` | Funds have been allocated for the payable. | policy approval evidence, funding transaction hash |
| `escrowed` | Funds are locked or held for the payable. | policy approval evidence, escrow transaction hash |
| `settled` | The payable has been paid. | policy approval evidence, settlement transaction hash, receipt hash, audit hash |
| `rejected` | The payable was denied. | rejection reason and rejection hash |
| `disputed` | The payable is contested. | policy evidence, dispute reason, dispute hash |

## Example

```ts
import { assessFinanceability, escrowedAgentWork, hashProof, verifyProof } from "arc-proof-of-payable";

const proofHash = hashProof(escrowedAgentWork);
const verification = verifyProof(escrowedAgentWork, proofHash);
const financeability = assessFinanceability(escrowedAgentWork);

console.log({ verification, financeability });
```

## Composer

Use the composer when another primitive or app has source refs and needs to produce a lifecycle-specific proof.

```ts
import { composeProofOfPayable } from "arc-proof-of-payable";

const proof = composeProofOfPayable({
  status: "escrowed",
  id: "pop_escrowed_001",
  payer: { kind: "organization", id: "org_microcosm_demo" },
  payee: { kind: "agent", id: "agent_market_researcher" },
  terms: {
    amount: "20.00",
    asset: "USDC",
    network: "arc-testnet",
    reason: "Market agent bankroll request"
  },
  intent: {
    intentId: "req_market_agent_001",
    intentHash: "0xe3d810c88443abc61bee60f482f0b7189bb63b216ba4353495e709b75ef75d25"
  },
  policy: {
    envelopeId: "env_arc_market_agent_001",
    policyHash: "0x3053048252804b1892e052db8bd52c71d1f5be710bc8246d39535286318d8c1f",
    approvalHash: "0x44af15df5983653f5dc0c339bddd6422ee7869815e7f86c424f12a205abfcc92",
    approval: {
      version: "evaluation.v1",
      status: "allowed",
      requestId: "req_market_agent_001",
      requestHash: "0xe3d810c88443abc61bee60f482f0b7189bb63b216ba4353495e709b75ef75d25",
      evaluatedAt: "2026-05-23T12:00:01.000Z",
      reasons: ["All envelope rules passed."],
      request: {
        version: "request.v1",
        id: "req_market_agent_001",
        payerId: "org_microcosm_demo",
        actorId: "agent_market_researcher",
        asset: "USDC",
        network: "arc-testnet",
        amount: "20.00",
        reason: "Market agent bankroll request",
        target: { kind: "venue", venueId: "venue_prediction_market_demo" },
        requestedAt: "2026-05-23T12:00:00.000Z",
        spentInPeriod: "10.00"
      },
      envelope: {
        version: "envelope.v1",
        id: "env_arc_market_agent_001",
        name: "Market agent bankroll envelope",
        actor: { allowedActorIds: ["agent_market_researcher"], grantMode: "hard" },
        asset: { network: "arc-testnet", asset: "USDC" },
        amount: { maxPerAction: "25.00", maxPerPeriod: "100.00", period: "day" },
        target: {
          allowedRecipientIds: ["recipient_research_desk"],
          allowedVenueIds: ["venue_prediction_market_demo"]
        },
        schedule: {
          days: ["mon", "tue", "wed", "thu", "fri", "sat", "sun"],
          startHourUtc: 0,
          endHourUtc: 24
        },
        createdAt: "2026-05-23T00:00:00.000Z"
      }
    }
  },
  escrow: {
    escrowId: "escrow_agent_work_001",
    escrowTxHash: "0x4444444444444444444444444444444444444444444444444444444444444444"
  }
});
```

This is the composition point for future standalone primitives:

```text
arc-agent-intent -> arc-policy-envelope -> arc-agent-work-escrow -> arc-proof-of-payable
```

## HTTP API and showcase

Build and start the local showcase server:

```bash
npm run build
npm start
```

Then open:

```text
http://127.0.0.1:8787
```

Endpoints:

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Liveness check |
| `POST` | `/proofs/hash` | Return deterministic proof hash |
| `POST` | `/proofs/verify` | Validate proof and optional expected hash |
| `POST` | `/proofs/financeability` | Return structural financeability result |
| `POST` | `/proofs/compose` | Compose a lifecycle proof from source refs |

Financeability API responses include `trust: "self_asserted"` and a warning because this package does not verify source systems, signatures, or Arc transaction state.

## Financeability v1

The initial financeability helper is conservative:

- `escrowed`: financeable, low risk
- `funded`: financeable, medium risk
- `policy_approved`: financeable, high risk
- `proposed`: not financeable
- `settled`: not financeable because it is already paid
- `rejected`: not financeable
- `disputed`: not financeable

This is not a credit model. It is an explainable eligibility helper other Arc apps can fork and extend.

## Repository structure

```text
src/
  types.ts            lifecycle-specific proof types
  canonical.ts        deterministic JSON serialization
  hash.ts             proof hashing helpers
  verify.ts           proof validation and hash verification
  compose.ts          lifecycle-specific proof composition
  api.ts              JSON API handler
  server.ts           local showcase server
  financeability.ts   simple financeability assessment
  examples.ts         typed sample proofs
public/
  index.html          browser showcase
  app.js              showcase client
  styles.css          showcase styles
examples/
  *.json              standalone example proof objects
test/
  *.test.ts           node:test coverage
```

## Use with Microcosm

Microcosm is the reference app path:

```text
Policy Envelope -> Agent Intent -> Escrow/Funding -> Settlement Receipt -> Proof of Payable
```

Microcosm can emit Proofs of Payable for agent work orders, market-agent bankroll requests, claimable payments, and payment-backed credit experiments. Other Arc builders can use this repo independently without adopting Microcosm.

## Arc OSS fit

This package is intended as a reusable Arc OSS primitive rather than a full payment app. It complements Circle `arc-*` reference apps by giving builders a portable proof layer for obligations and settlement evidence produced around commerce, escrow, agent, receivable, or payout flows.

Submission-ready surfaces:

- Lifecycle-specific TypeScript proof model instead of one loose optional-field object.
- SDK functions for composing, hashing, verifying, and assessing proof objects.
- Local JSON API and static showcase for proof inspection.
- Policy approval binding with `arc-policy-envelope` evidence.
- Example proof JSON fixtures for proposed, rejected, policy-approved, escrowed, and settled paths.
- Tests for verification, composition, financeability, API behavior, showcase serving, policy integration, and Hermes-style agent guardrails.

## Commands

```bash
npm install
npm run typecheck
npm test
npm run build
```

## Non-goals

- No private key management.
- No wallet custody.
- No RPC calls.
- No onchain writes.
- No production credit underwriting.
- No optional-field proof soup.
