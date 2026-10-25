# Sequential implementation milestones

All statuses initially NOT STARTED. Work M0–M7 in order. Every gate requires observed evidence, not just authored code.
After passing a gate, record commands/results in PROGRESS.md and evidence/Mx.md and proceed autonomously.
A failure blocks dependent milestones; fix it without silently weakening the checks.
Estimates are rough implementation allocations, not deadlines. Eight hours is optimistic and excludes foundational learning.

## M0 — Establish the executable protocol profile (~45 min)

Read project documents and paper Sections 4–5. Inspect environment and official SDK examples.
Choose/pin Node, package manager, Hardhat, Solidity compiler, A2A SDK, and x402 libraries. Commit a lockfile when repo policy permits.
Resolve the exact transfer method, custom network/asset configuration, A2A wire profile, and settle-before-handler adapter approach.
Create minimal project configuration and ignored local environment handling.

**Gate:** dependency install, compilation of a tiny contract, typecheck, and local-node RPC chain ID query all succeed. Show through inspected SDK source/example that custom-network EIP-3009 settlement and chosen lifecycle are implementable; record paths/versions.
**Evidence:** exact versions, commands, profile decisions, and unresolved risks in DECISIONS.md. No unresolved incompatibility may be hidden.

## M1 — Prove local execution and token accounting (~60 min)

Deploy/call Counter as a small learning check. Implement/deploy TestUSD, seed client with 100 tokens.
Use ordinary token transfer to move funds and inspect receipts.
Implement/test EIP-3009 authorization execution with a distinct submitting account.

**Gate:** signed 2-token transfer produces client=98, recipient=2, a successful receipt/Transfer event, consumed nonce, and gas paid by submitter. Invalid signature, expiry, replay, and insufficient token balance leave token balances unchanged. Unauthorized mint fails.
Restore the clean funded fixture for later tests. Observe real local execution, not mocked balances.
**Evidence:** contract test results and sanitized receipt/balance output.

## M2 — Run the separate facilitator (~60 min)

Implement independent facilitator process and configured gas signer using chosen SDK implementation.
Expose health, supported, verify, settle; add minimal persistent settlement records and per-authorization serialization.
A small test client can construct payments before full A2A exists.

**Gate:** /supported advertises exact local profile; /verify of a valid payment changes no balances and submits no transaction; /settle transfers once and returns confirmed receipt identity.
Wrong payTo/amount/asset/network is rejected without broadcast. Repeat/concurrent identical settlement cannot transfer twice; direct settle also validates. Missing gas fails safely. Server-side application key is not needed by facilitator.
**Evidence:** HTTP contract tests and blockchain receipts. Do not progress on a hosted or fake facilitator substitute.

## M3 — Publish and retrieve the on-chain AgentCard (~45 min)

Deploy AgentCard with canonical card JSON and payment extension; set it as the approved recipient.
Implement owner-only update/withdrawal and active status. Configure the client-side card reader.
Extend deployment manifest with chain ID, contract addresses, token domain metadata, and public account roles.

**Gate:** reader obtains the endpoint, skill, exact base-unit price and payTo from the contract, validates the selected A2A card schema and extension profile. Unauthorized edits/withdrawals fail; authorized ones work. Deposit tokens to card then withdraw through owner; reset fixture.
Reject inactive card and wrong chain/missing contract.
**Evidence:** contract tests and parsed card. Known-address retrieval is described accurately.

## M4 — Prove the basic A2A service (~45 min)

Run a real A2A SDK service and client for the statistics skill.
Use a test-only unpaid harness to validate protocol behavior; do not expose an unpaid production service route once M5 payment gate is installed.
Use small finite number arrays and explicit input limits.

**Gate:** official SDK client produces correct result for [2,4,6] through the chosen binding. Invalid input fails predictably; card extension declaration and any required activation follow the selected profile.
HTTP and on-chain cards have matching effective terms. No dummy custom JSON-RPC endpoint labelled A2A.
**Evidence:** service tests and sanitized messages.

## M5 — Connect challenge, authorization, settlement, delivery (~90 min)

Integrate client payment transport and server gate with the separate facilitator.
Client retrieves on-chain card; sends unpaid request; reads challenge; checks terms/budget; signs and retries the same request.
Server validates input, verifies payment, settles through facilitator, waits for confirmation, then runs service.

**Gate:** one end-to-end run starting client=100/card=0 finishes client=98/card=2, exactly one transfer and one service execution, correct A2A result and payment receipt.
Unpaid request yields challenge and zero execution. Wrong/excessive challenge causes no client signature. Failed settlement yields no service execution.
Demonstrate separately running node, facilitator, server, and client. Trace proves settlement precedes execution.
**Evidence:** reproducible integration command and correlated HTTP/chain/service trace.

## M6 — Prove failure recovery and idempotency (~90 min)

Complete durable request/result records and settlement reconciliation.
Use controlled mining, RPC fault injection, or response dropping to exercise real transactions with uncertain HTTP outcomes.
Test duplicate requests, changed bodies, restarts, and spent authorizations.

**Gate:** mandatory matrix:
- Concurrent/repeated identical paid request: one charge and one logical service execution; same recorded result.
- Same request ID with changed body, conflicting payer, or authorization reused for another request: reject without extra charge/result disclosure.
- Lost settlement response after successful broadcast: reconcile original transaction; no second payment.
- Pending confirmation: explicit pending/unknown status, no premature service execution.
- Server restart after settlement and before result response: recover without charging again; completed result is retrievable only with proper association.
- Definitive settlement failure: token balances unchanged and service not executed.
- Service exception after settlement: preserve paid-but-undelivered record, no automatic fresh authorization/refund.
- Local chain reset: stale manifest/stores are detected or safely reinitialized.
Document the EIP-3009 request-body binding limitation; do not overclaim exactly-once execution across arbitrary crashes for external side effects. Our service is deterministic and side-effect-free.
**Evidence:** integration/fault-test report, persisted records, receipt reconciliation.

## M7 — Reproduce from clean state and explain (~45 min)

Create verified root scripts for node startup, deploy/seed, facilitator, server, tests, and demo.
Use a simple CLI trace; no UI requirement. Include precise teardown/reset behavior.
Run a fresh deployment and the full necessary checks. Produce a concise paper-comparison note and recording walkthrough.

**Gate:** clean local run passes M1–M6 coverage, demo reproduces [2,4,6] result and one payment, README commands are verified, no keys leaked, sources/limitations/dependency pins are documented.
Evidence includes actual transaction hash, before/after balances, facilitator gas role, and protocol receipt. A walkthrough is not claimed to be a recorded video.
**Evidence:** evidence/M7.md, demo trace, completed PROGRESS.md. If any check is skipped, overall completion remains qualified.

