# Project specification

## Purpose

Reimplement the architecture from "Towards Multi-Agent Economies: Enhancing the A2A Protocol with Ledger-Anchored Identities and x402 Micropayments for AI Agents" (arXiv:2507.19550v1).
Show understanding by tracing on-chain AgentCard retrieval, A2A messaging, signed payment authorization, a separate facilitator, and actual local settlement.

## Decisions and defaults

**Explicit user choice:** separate facilitator process.
**Established scope:** one client agent, one service agent, one local Ethereum node, TestUSD token contract, and AgentCard contract.
**Working defaults:** Hardhat toolchain/node; TypeScript; Solidity; deterministic statistics service; fixed 2 TestUSD charge; architectural rather than historical wire-format reproduction.
These defaults can be resolved during implementation without unnecessary clarification. Record changes and their consequences.
Anvil may replace the Hardhat node if a concrete compatibility issue justifies it. Do not run two unrelated chains by accident.

## Service and accounting fixture

Input: a small finite array of numbers; reject malformed/empty/oversized input before payment settlement.
Output: count, sum, minimum, maximum, and mean.
Canonical example: input [2, 4, 6]; output count=3, sum=12, min=2, max=6, mean=4.
Token: TestUSD, 6 decimals, no dollar backing.
Price: 2,000,000 base units (2 TestUSD). Initial client balance: 100,000,000.
Recipient: AgentCard contract; initial token balance zero. Owner-only withdrawal.
Facilitator account has local ETH to pay gas; client only needs TestUSD for the authorization path.
Native ETH balances are separate from token balances.

## Proposed project structure

No concrete folder layout was previously selected in conversation. This layout makes the selected architecture explicit.

```text
a2a-x402-local/
  AGENTS.md
  README.md
  PROJECT.md
  ARCHITECTURE.md
  MILESTONES.md
  PROGRESS.md
  DECISIONS.md
  REFERENCES.md
  TAKEOVER_PROMPT.md
  package.json
  package-lock.json                 # choose one package manager/lockfile in M0
  tsconfig.json
  hardhat.config.ts
  .env.example                     # names/placeholders only
  .gitignore
  contracts/
    Counter.sol                    # small learning smoke test
    TestUSD.sol
    AgentCard.sol
  apps/
    client/src/
      index.ts
      discovery.ts
      payment.ts
    server/src/
      index.ts
      agent.ts
      payment-gate.ts
      request-store.ts
    facilitator/src/
      index.ts
      verification.ts
      settlement.ts
      settlement-store.ts
  packages/shared/src/
    config.ts
    chain.ts
    payment-profile.ts
    schemas.ts
  scripts/
    deploy.ts
    seed.ts
    demo.ts
    verify.ts
  tests/
    contracts/
    integration/
    fixtures/
  deployments/local.json            # generated public addresses/config, no keys
  runtime/                         # ignored local state, separated by service
  evidence/                        # sanitized gate reports and demo trace
  sources/
    paper.pdf
    learn-article.pdf
```

The application file names are responsibilities, not a requirement to create unnecessary wrappers. A minimal shared root package is enough; separate package manifests/workspace orchestration are optional only if useful.

## Definition of done

From a clean documented setup: start one node, deploy/seed, start facilitator and server, run client.
Client obtains endpoint and payment terms from the on-chain card; payment reaches the card contract exactly once; correct A2A result and settlement receipt return.
Mandatory failure and recovery checks pass. README includes verified commands. Progress and evidence reflect actual results.

## Out of scope and limitations

No real funds, public chain deployment, arbitrary agent discovery, reputation, escrow, arbitration, or quality guarantees.
The client knows the bootstrap contract address and RPC. This is card retrieval, not discovering all agents on the internet.
Local execution validates transaction mechanics, not decentralized security or public-chain latency.
Keep a short demo script and instructions for recording; do not claim a video exists unless actually produced.

