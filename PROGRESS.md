# Build progress

## Current status — 2026-10-25

Core prototype: COMPLETE. M0–M7 passed, including a fresh-chain reproduction with a
separate facilitator and real confirmed token settlement. All processes started
by the reproduction script were stopped when it finished.

Browser iteration: implementation complete; API/SSE integration, lifecycle checks,
typechecking, artifact scanning, and original CLI regression checks passed. The
user approved `iterate.md` before implementation. Rendered browser QA is unavailable
in this session and remains unverified.

## Milestone ledger

- M0 protocol/tooling: PASS.
- M1 local contracts/token: PASS.
- M2 separate facilitator: PASS.
- M3 on-chain AgentCard: PASS.
- M4 basic A2A: PASS.
- M5 paid A2A integration: PASS.
- M6 failure/recovery: PASS.
- M7 clean reproduction: PASS.

## Verified commands

Run from the Build project root:

- `npm ci --offline --cache /home/ronit/.npm --ignore-scripts --no-audit --no-fund`
- `npm ls --depth=0`
- `npm run compile` — official solc-js 0.8.38 compiled Counter, TestUSD, AgentCard and imported OpenZeppelin sources.
- `npm run typecheck` — application, shared, tooling and integration TypeScript passes.
- `npm run check:loopback` — loopback listener check passed with approved local access.
- `npm run node` — Hardhat on 127.0.0.1:8545; eth_chainId returned `0x7a69` (31337).
- `npm run m1:local` — contract deployment, EIP-3009 positive/negative cases, and fixture restoration passed.
- `npm run facilitator` — standalone facilitator on 127.0.0.1:4022.
- `npm run m2:check` — x402 `/supported`, read-only `/verify`, strict profile rejection, concurrent single settlement, conflicting replay, missing-gas failure, and fixture restoration passed.
- `npm run m3:check` — card retrieval, schema/payment validation, active status, chain/contract rejection, and ownership checks passed.
- `npm run m4:check` — official SDK client/service, extension activation, matching cards and input validation passed.
- `npm run m5:check` — separate-process paid A2A demo and ordered settlement-before-execution trace passed.
- `npm run m6:check` and `npm run m6:reset-check` — real recovery/fault matrix and actual node-reset rejection passed.
- `npm run m7:reuse-check` — reused addresses/bytecode do not bypass the deployment block anchor.
- `npm run reproduce` — full M1–M6 coverage from a fresh node, reset checks, redeployment and final paid demo passed.
- `npm run check:artifacts` — both signer keys restricted to ignored runtime, source/evidence scan passed, original paper hash unchanged.

## Known failing command

- `npm run compile:hardhat` — Hardhat compiler subprocess output parsing fails. Default `npm run compile` uses installed official solc-js directly and passes.

## Final evidence

See [evidence/M7.md](evidence/M7.md), [evidence/M7-result.json](evidence/M7-result.json),
[evidence/demo.json](evidence/demo.json), and [evidence/M6-result.json](evidence/M6-result.json).
Final demo: [2,4,6] → count=3, sum=12, min=2, max=6, mean=4; client/card
100/0 → 98/2 TestUSD. Confirmed transaction:
`0x216158775e1563e49741f22190bd0592f6f8bbbf581d4bd62bd506edcdf38e2b`.

No further original milestone work remains. README contains the verified setup/manual
run/reproduction commands. A new node requires deployment/seed again because
Hardhat's in-memory state was torn down. The recording walkthrough is a script,
not a claim that a video exists.

## Resume notes

The paper's Sections 4–5 and all project documents were read. Source PDFs are
unchanged. Build is the implementation root; `a2a-x402-local/` is reference
material. Node v22.23.1, npm 10.9.8; pins and protocol decisions are in
DECISIONS.md. Distinct client/facilitator signers are stored only in ignored
`runtime/client-key.json` and `runtime/facilitator-key.json`, mode 0600. The
service reads neither. Public deployment metadata is in deployments/local.json.
Pending settlement never unlocks computation; paid service exceptions remain
paid-undelivered. EIP-3009/body binding and local-chain limitations are documented
in PAPER_COMPARISON.md and evidence/M6.md.

No git repository is available. Do not push or publish unless requested.

## Browser iteration — 2026-10-25

- Added local dashboard, `npm run ui`, on `127.0.0.1:4030`.
- Browser controls start/check node, compilation, deployment fixture, facilitator,
  and server. Fixed commands, loopback origin/session controls, process ownership,
  and sanitized bounded SSE logs are implemented.
- Real IPC checkpoints expose card read, unpaid request, authorization, paid retry,
  verification, settlement, and confirmed-payment service execution individually.
- Interactive four-actor diagram follows the supplied reference. Configuration
  guide explains all current `local.json` fields. Evidence includes live balances,
  actual token events/receipt, public authorization, and A2A result.
- Friendly CLI connection errors cover the reported missing server at port 4021.
- Interrupted runs can resend the same stored proof without a new signature;
  definitive application outcomes can be acknowledged, while pending state remains
  unresolved. Public run histories survive backend restart.
- Initial API/SSE integration passed: all manual checkpoints, a real payment,
  settlement before computation, cancellation after settlement, same-proof recovery,
  origin/action restrictions, public output key checks, and chunk-safe redaction.
- `npm run reproduce` passed M0–M7 after payment instrumentation changes, including
  pending/mined, no-gas, duplicates, process crashes, stale resets, and final CLI
  delivery. Final CLI transaction:
  `0x3e38fe2c99b897d20a64329219587b52fd86a382d20ffea2a051e9834061d7c3`.
- `npm run typecheck` and browser JavaScript syntax checking passed.
- Final focused `npm run ui:check`: PASS. It verified real pause expiry, reported
  CLI-error diagnostics, and actual node-restart invalidation in addition to the
  payment/recovery flow. See `evidence/UI-result.json` and `evidence/UI.md`.
- A separate real external-node check passed: the dashboard detected external
  ownership, rejected its Stop action, and the node continued responding.
- ANSI/chunk/oversized-line redaction checks passed. Final `check:artifacts` passed:
  signer permissions 0600, no signer keys in authored/public artifacts, paper intact.
- Browser inventory is empty (`cua.getState()`); no rendered UI, responsive layout,
  or keyboard interaction check has been claimed.
- Final teardown verified ports 4030, 8545, 4022, and 4021 are all free. Start
  `npm run ui` for a new manual session, then start/deploy through the browser.
